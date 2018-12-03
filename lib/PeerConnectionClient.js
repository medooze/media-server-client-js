const SemanticSDP	= require("semantic-sdp");
const SDPInfo		= SemanticSDP.SDPInfo;
const StreamInfo	= SemanticSDP.StreamInfo;
const TrackInfo		= SemanticSDP.TrackInfo;

class PeerConnectionClient
{
	constructor(params)
	{
		//Store peer connection
		this.id = params.id;
		this.ns = params.ns;
		this.pc = params.pc;
		this.remote  = params.remote;
		this.streams = {};
		
		//the list of pending transceivers 
		this.pending = new Set();
		this.processing = new Set();
		this.renegotiating = false;
		
		//Dummy events
		this.ontrack		= (event) => console.log("ontrack",event);
		this.ontrackended	= (event) => console.log("ontrackended",event);
		this.onstatsended	= (event) => console.log("onstatsended",event);
		
		//Forward events
		this.pc.ontrack		= (event) => { 
			//Store streams from event
			event.receiver.streams = event.streams; 
			//Set remote ids
			event.remoteStreamId = event.transceiver.streamId;
			event.remoteTrackId  = event.transceiver.trackId;
			//Re-fire
			this.ontrack(event); 
		};
		this.pc.onstatsended	= (event) => this.onstatsended(event);
		
		this.pc.onnegotiationneeded = () => this.renegotiate();
		
		//Listen for events
		this.ns.on("event",(event)=> {
			//Get event data
			const data = event.data;
			//Check event name
			switch(event.name)
			{
				case "addedtrack":
				{
					let transceiver;
					//Get track info
					const trackInfo = TrackInfo.expand(data.track);
					//Check if we can reuse a transceiver
					for (let reused of this.pc.getTransceivers())
					{
						//If inactive and  not pending or stopped
						if (reused.receiver.track.kind==trackInfo.getMedia() && reused.direction=="inactive" && !reused.pending && !reused.stopped)
						{
							//reuse
							transceiver = reused;
							//Set new direction
							transceiver.direction = "recvonly";
							//Done
							break;
						}
					}
					//If we can't reuse
					if (!transceiver)
						//Add new recv only transceiver
						transceiver = this.pc.addTransceiver(trackInfo.getMedia(),{
							direction : "recvonly"
						});
					//Get stream
					let stream = this.streams[data.streamId];
					//If not found
					if (!stream)
						//Create new one
						this.streams[data.streamId] = stream = new StreamInfo(data.streamId);
					//Add track info
					stream.addTrack(trackInfo);
					//Store stream and track info
					transceiver.streamId = data.streamId;
					transceiver.trackId = trackInfo.getId();
					transceiver.trackInfo = trackInfo;
					//Set flag
					transceiver.pending = true;
					//To be processed
					this.pending.add(transceiver);
					break;
				}
				case "removedtrack":
				{
					//Look for the transceiver
					for (let transceiver of this.pc.getTransceivers())
					{
						//Is it it?
						if (transceiver.streamId == data.streamId && transceiver.trackId == data.trackId)
						{
							//Stop transceiver
							transceiver.direction = "inactive";
							//Remove track
							this.streams[transceiver.streamId].removeTrack(transceiver.trackInfo);
							//Lunch event
							this.ontrackended(new (RTCTrackEvent || Event)("trackended",{
								receiver	: transceiver.receiver,
								track		: transceiver.receiver.track,
								streams		: transceiver.receiver.streams,
								transceiver	: transceiver,
								remoteStreamId	: transceiver.streamId,
								remoteTrackId	: transceiver.trackId
							}));
							//Mark for clean up
							transceiver.cleanup = true;
							//Set flag
							transceiver.pending = true;
							//To be processed
							this.pending.add(transceiver);
							//Done
							break;
						}
					}
					break;
				}
				case "stopped" :
					//Stop us
					this.stop();
					break;
			}
		});
	}
	
	async renegotiate()
	{
		//On chrome negotiation needed is fired multtiple times one per transceiver
		if (this.renegotiating)
			//Nothing to do
			return;
		
		//We are renegotiting, we need the flag as the function is async
		this.renegotiating = true;
		
		//Get the pending transceivers and process them
		const processing = this.pending;
		
		//Create new set, so if a new transceiver is added while renegotiating, it is not lost
		this.pending = new Set();
		//Get current transceivers
		const transceivers = this.pc.getTransceivers();
		
		//Create offer
		const offer = await this.pc.createOffer();
		
		//Update offer
		offer.sdp = fixLocalSDP(offer.sdp,transceivers);
		
		//Set local description
		await this.pc.setLocalDescription(offer);
		
		//Store previous info
		const prevInfo = this.localInfo;
		
		//Parse local info 
		//Firefox uses old simulcast so switch back
		this.localInfo = SDPInfo.parse(offer.sdp.replace(": send rid=",":send "));
		
		//Get remote sdp
		this.remoteInfo = this.localInfo.answer(this.remote);
		
		//For all transceivers
		for (const transceiver of this.pc.getTransceivers())
		{
			//If we have to override the codec
			if (transceiver.codecs)
			{
				//Get local media
				const localMedia = this.localInfo.getMediaById(transceiver.mid);
				//Get remote capabilities
				const capabilities = this.remote.capabilities[localMedia.getType()];
				//If got none
				if (!capabilities)
					//Skip
					continue;
				//Clone capabilities for the media
				const cloned = Object.assign({},capabilities);
				//Set codecs
				cloned.codecs = transceiver.codecs;
				//Answer it
				const answer = localMedia.answer(cloned);
				//Replace media
				this.remoteInfo.replaceMedia(answer);
			}
		}
		
		//Procces pending transceivers
		for (let transceiver of processing)
		{
			//Check if it is a local or remote track
			if (transceiver.direction==="sendonly")
			{
				//Get mid
				const mid = transceiver.mid;
				//Get track for it
				const track = this.localInfo.getTrackByMediaId(mid);
				//signal it
				this.ns.event("addedtrack",{
					streamId	: transceiver.sender.streamId,
					track		: track.plain()
				});
			} else if (transceiver.direction==="recvonly") {
				//Get mid
				const mid = transceiver.mid;
				//Get track
				const trackInfo = transceiver.trackInfo;
				//Assing
				trackInfo.setMediaId(mid);
			} else if (transceiver.direction==="inactive" && !transceiver.trackInfo) {
				//Get mid
				const mid = transceiver.mid;
				//Get previous
				const track = prevInfo.getTrackByMediaId(mid);
				//signal it
				this.ns.event("removedtrack",{
					streamId	: transceiver.sender.streamId,
					trackId		: track.getId()
				});
				//Delete stuff
				delete(transceiver.sender.streamId);
				delete(transceiver.fixSimulcastEncodings);
			} else if (transceiver.direction==="inactive" && transceiver.cleanup) {
				//Delete stuff
				delete(transceiver.cleanup);
				delete(transceiver.streamId);
				delete(transceiver.trackId);
				delete(transceiver.trackInfo);
			}
		}
		
		//Now add all remote streams 
		for (let stream of Object.values(this.streams)) 
		{
			//Clone stream
			const cloned = new StreamInfo(stream.getId());
			//For each track
			for (let [trackId,track] of stream.getTracks())
				//Ensure it has been processed already to avoid having a track without an assigned media id
				if (track.getMediaId())
					//Safe to add it back
					cloned.addTrack(track);
			//Add it
			this.remoteInfo.addStream(cloned);
		}
		
		//Set it
		await this.pc.setRemoteDescription({
			type	: "answer",
			sdp	: this.remoteInfo.toString().replace(":recv ",": recv rid=")
		});
		
		//Procces pending transceivers again
		for (let transceiver of processing)
			//Delete flag
			delete(transceiver.pending);
		
		//We are not renegotiting
		this.renegotiating = false;
		
		//If there are new pending
		if (this.pending.size)
			//Renegotiate again
			this.renegotiate();
	}

	getStats(selector)
	{
		return this.pc.getStats(selector);
	}
	
	async addTrack(track,stream,params)
	{
		//Flag to force a renegotition
		let force = false;
		//Get send encodings
		const sendEncodings = params && params.encodings || [];
		//Create new transceiver
		const transceiver = this.pc.addTransceiver(track,{
			direction	: "sendonly",
			streams		: stream ? [stream] : [],
			sendEncodings	: sendEncodings
		});
		
		//Add track to sender
		transceiver.sender.streamId = stream ? stream.id : "-";
		
		//Hack for firefox as it doesn't support enabling simulcast on addTransceiver but on sender.setParameters
		try { 
			//If doing simulcast
			if (sendEncodings.length)
				//Set simuclast stuff
				await transceiver.sender.setParameters({encodings: sendEncodings});
			//Force renegotiation as event will have trigger before the event
			force = true;
		} catch(e) {
		}
		
		//Get send params
		const sendParameters = transceiver.sender.getParameters();
		//Check if we need to fix simulcast info
		if ((sendParameters.encodings ? sendParameters.encodings.length : 0 )!==sendEncodings.length)
			//Store number of simulcast streams to add
			transceiver.fixSimulcastEncodings = sendEncodings;
		//If we have to override codec
		if (params && params.codecs)
			//Set it on transceicer
			transceiver.codecs = params.codecs;
		//Set flag
		transceiver.pending = true;
		//Pending to signal
		this.pending.add(transceiver);
		
		//Enqueue a renegotiation, as 
		if (force)
			//Renegotiate on next tick
			setTimeout(()=>this.renegotiate(),0);
		//Done
		return transceiver.sender;
	}
	
	
	removeTrack(sender)
	{
		//Find transceiver for this
		for (let transceiver of this.pc.getTransceivers())
		{
			//If it is for this sender
			if (transceiver.sender===sender)
			{
				//Set flag
				transceiver.pending = true;
				//Add the transceiver to the pending list
				this.pending.add(transceiver);
			}
		}
		//Remove it 
		this.pc.removeTrack(sender);
	}
	
	stop()
	{	
		//Stop peerconnection
		this.pc.stop();
		//Stop namespace
		this.ns.stop();
		//Null
		this.pc = null;
		this.ns = null;
	}
	
	
}

let ssrcGen = 0;

function getNextSSRC()
{
	return ++ssrcGen;
}

function fixLocalSDP(sdp,transceivers)
{
	//Find first m line
	let ini = sdp.indexOf("\r\nm=");

	//The fixed sdp
	let fixed = sdp.substr(0,ini);

	//Check if each media info has the appropiate simulcast info
	for (const transceiver of transceivers)
	{
		//Find next m line
		let end = sdp.indexOf("\r\nm=",ini+1);
		//Get m line
		let media = sdp.substring(ini,end!==-1 ? end : undefined);
		//Move to next
		ini = end;

		//Check if we need to fix the simuclast info
		const fixSimulcastEncodings = transceiver.fixSimulcastEncodings;

		//Do we need to do sdp mangling?
		if (fixSimulcastEncodings && !fixSimulcastEncodings.inited)
		{
			//OK, chrome way
			const reg1 = RegExp("m=video.*\?a=ssrc:(\\d*) cname:(.+?)\\r\\n","s");
			const reg2 = RegExp("m=video.*\?a=ssrc:(\\d*) mslabel:(.+?)\\r\\n","s");
			const reg3 = RegExp("m=video.*\?a=ssrc:(\\d*) msid:(.+?)\\r\\n","s");
			const reg4 = RegExp("m=video.*\?a=ssrc:(\\d*) label:(.+?)\\r\\n","s");
			//Get ssrc and cname
			let res = reg1.exec(media);
			const ssrc = res[1];
			const cname = res[2];
			//Get other params
			const mslabel = reg2.exec(media)[2];
			const msid = reg3.exec(media)[2];
			const label = reg4.exec(media)[2];
			//Add simulcasts ssrcs
			const num = fixSimulcastEncodings.length-1;
			const ssrcs = [ssrc];

			for (let i=0;i<num;++i)
			{
				//Create new ssrcs
				//TODO: Check no overlap
				const ssrc = getNextSSRC();
				const rtx   = getNextSSRC();
				//Add to ssrc list
				ssrcs.push(ssrc);
				//Add sdp stuff
				media +="a=ssrc-group:FID " + ssrc + " " + rtx + "\r\n" +
					"a=ssrc:" + ssrc + " cname:" + cname + "\r\n" +
					"a=ssrc:" + ssrc + " msid:" + msid + "\r\n" +
					"a=ssrc:" + ssrc + " mslabel:" + mslabel + "\r\n" +
					"a=ssrc:" + ssrc + " label:" + label + "\r\n" +
					"a=ssrc:" + rtx + " cname:" + cname + "\r\n" +
					"a=ssrc:" + rtx + " msid:" + msid + "\r\n" +
					"a=ssrc:" + rtx + " mslabel:" + mslabel + "\r\n" +
					"a=ssrc:" + rtx + " label:" + label + "\r\n";
			}
			//Add SIM group
			media += "a=ssrc-group:SIM " + ssrcs.join(" ") + "\r\n";
			//Simulcast fake lines
			media += "a=simulcast:send " + fixSimulcastEncodings.map(e => e.rid).join(";") +"\r\n";
			//For each encoding
			for (let i=0;i<fixSimulcastEncodings.length;++i)
			{
				//Add RID equivalent
				media += "a=rid:" + fixSimulcastEncodings[i].rid + " send ssrc="+ssrcs[i]+"\r\n";
				//Store ssrc
				fixSimulcastEncodings[i].ssrc = ssrcs[i];
			}
			media += "a=x-google-flag:conference\r\n";
			//Done
			fixSimulcastEncodings.inited = true;
		} else if (fixSimulcastEncodings && !fixSimulcastEncodings.inited) {
			//Simulcast fake lines
			media += "a=simulcast:send " + fixSimulcastEncodings.map(e => e.rid).join(";") +"\r\n";
			//For each encoding
			for (let i=0;i<fixSimulcastEncodings.length;++i)
			{
				//Add RID equivalent
				media += "a=rid:" + fixSimulcastEncodings[i].rid + " send ssrc="+ssrcs[i]+"\r\n";
				//Store 
			}
			media += "a=x-google-flag:conference\r\n";
		} else {
			//Nothing
		}
		//Remove not usedcodecs
		if (transceiver.codecs)
			//For all video codecs
			for (let codec of ["vp8","vp9","h264"])
				//If not allowed
				if (!transceiver.codecs.includes(codec))
					//Remove it
					media = removeCodec(media,codec);
		//Add media to fixed
		fixed += media;
	}
	
	return fixed;
}

//From : https://gist.github.com/tnoho/948be984f9981b59df43
function removeCodec(orgsdp, codec) 
{
	const internalFunc = function(sdp) 
	{
		const codecre = new RegExp("(a=rtpmap:(\\d*) " + codec + "\/90000\\r\\n)","i");
		const rtpmaps = sdp.match(codecre);
		if (rtpmaps == null || rtpmaps.length <= 2)
			return sdp;

		const rtpmap = rtpmaps[2];
		let modsdp = sdp.replace(codecre, "");

		const rtcpre = new RegExp("(a=rtcp-fb:" + rtpmap + ".*\r\n)", "g");
		modsdp = modsdp.replace(rtcpre, "");
		
		const fmtpre = new RegExp("(a=fmtp:" + rtpmap + ".*\r\n)", "g");
		modsdp = modsdp.replace(fmtpre, "");
		
		const aptpre = new RegExp("(a=fmtp:(\\d*) apt=" + rtpmap + "\\r\\n)");
		const aptmaps = modsdp.match(aptpre);
		let fmtpmap = "";
		if (aptmaps != null && aptmaps.length >= 3) 
		{
			fmtpmap = aptmaps[2];
			modsdp = modsdp.replace(aptpre, "");
		
			const rtppre = new RegExp("(a=rtpmap:" + fmtpmap + ".*\r\n)", "g");
			modsdp = modsdp.replace(rtppre, "");
		}

		const videore = /(m=video.*\r\n)/;
		const videolines = modsdp.match(videore);
		if (videolines != null) 
		{
			//If many m=video are found in SDP, this program doesn"t work.
			const videoline = videolines[0].substring(0, videolines[0].length - 2);
			const videoelem = videoline.split(" ");
			let modvideoline = videoelem[0];
			for (let i = 1; i < videoelem.length; i++) 
			{
				if (videoelem[i] == rtpmap || videoelem[i] == fmtpmap) 
					continue;
				modvideoline += " " + videoelem[i];
			}
			modvideoline += "\r\n";
			modsdp = modsdp.replace(videore, modvideoline);
		}
		return internalFunc(modsdp);
	};
	return internalFunc(orgsdp);
}

module.exports = PeerConnectionClient;