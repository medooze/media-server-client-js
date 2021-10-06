const SemanticSDP	= require("semantic-sdp");
const SDPInfo		= SemanticSDP.SDPInfo;
const StreamInfo	= SemanticSDP.StreamInfo;
const TrackInfo		= SemanticSDP.TrackInfo;
const Direction		= SemanticSDP.Direction;

class PeerConnectionClient
{
	constructor(params)
	{
		//Store peer connection
		this.id = params.id;
		this.ns = params.ns;
		this.pc = params.pc;
		this.remote  = params.remote;
		this.localInfo = params.localInfo;
		this.remoteInfo = null;
		this.streams = {};
		this.strictW3C = params.strictW3C;
		this.forceSDPMunging = params.forceSDPMunging;
		this.forceRenegotiation = params.forceRenegotiation;
		
		//the list of pending transceivers 
		this.pending = new Set();
		this.processing = new Set();
		this.renegotiating = false;
		
		//List of tracks to be removed and added
		this.adding = new Set();
		this.removing = new Set();
		
		//Disable all existing transceivers
		for (const transceiver of this.pc.getTransceivers())
		{
			//Disable it
			transceiver.direction = "inactive";
			//Set flag
			transceiver.pending = true;
			//Add to pending
			this.pending.add(transceiver);
		}
		
		//Dummy events
		this.ontrack		= (event) => console.log("ontrack",event);
		this.ontrackended	= (event) => console.log("ontrackended",event);
		this.onstatsended	= (event) => console.log("onstatsended",event);
		
		//Forward events
		this.pc.ontrack		= (event) => { 
			//Store streams from event
			event.transceiver.trackInfo.streams = event.streams; 
			//Set remote ids
			event.remoteStreamId = event.transceiver.streamId;
			event.remoteTrackId  = event.transceiver.trackId;
			try {
				//Re-fire
				this.ontrack(event); 
			} catch (e) {
				console.error(e);
			};
		};
		this.pc.onstatsended	= (event) => {
			try {
				//Relaunch event
				this.onstatsended(event);
			} catch (e) {
				console.error(e);
			} 
		};
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
					//Add it for later addition
					this.adding.add(data);
					//Reneogitate
					this.renegotiate();
					break;
				}
				case "removedtrack":
				{
					//Add it for later removal
					this.removing.add(data);
					//Renegotiate 
					this.renegotiate();
					break;
				}
				case "stopped" :
					//Stop us
					this.close();
					break;
			}
		});
		
		//Renegotiate now
		this.renegotiate();
	}
	
	async renegotiate()
	{
		//Detect simulcast-03 used by firefox
		let simulcast03 = false;
		//On chrome negotiation needed is fired multtiple times one per transceiver
		if (this.renegotiating)
			//Nothing to do
			return;
		
		//We are renegotiting, we need the flag as the function is async
		this.renegotiating = true;
		
		//Process addingionts first
		for (const data of this.adding)
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
		}
		//Clear new remote track queue
		this.adding.clear();
		
		//Process pending tracks to be removed
		for (let data of this.removing)
		{
			//Get stream and track
			const streamInfo = this.streams[data.streamId]; 
			const trackInfo = streamInfo.getTrack(data.trackId);
			//Get associated mid
			const mid = trackInfo.getMediaId();
			//Look for the transceiver
			for (let transceiver of this.pc.getTransceivers())
			{
				//If the transceiver has been processed
				if (!transceiver.pending && transceiver.mid && transceiver.mid == mid )
				{
					//Deactivate transceiver
					transceiver.direction = "inactive";
					//Remove track
					streamInfo.removeTrack(trackInfo);
					//If this has no more tracks
					if (!streamInfo.getTracks().size)
						//Delete it
						delete (this.streams[transceiver.streamId]);
					try{
						//Launch event
						this.ontrackended(new (RTCTrackEvent || Event)("trackended",{
							receiver	: transceiver.receiver,
							track		: transceiver.receiver.track,
							streams		: trackInfo.streams,
							transceiver	: transceiver,
							remoteStreamId	: streamInfo.getId(),
							remoteTrackId	: trackInfo.getId()
						}));
					} catch (e) {
						console.error(e);
					}
					//Delete stuff
					delete(transceiver.streamId);
					delete(transceiver.trackId);
					delete(transceiver.trackInfo);
					//Delete from pending
					this.removing.delete(data);
					//Done
					break;
				}
			}
		}
		
		//Get the pending transceivers and process them
		const processing = this.pending;
		
		//Create new set, so if a new transceiver is added while renegotiating, it is not lost
		this.pending = new Set();
		
		//Get current transceivers
		const transceivers = this.pc.getTransceivers();
		
		//Skip for first SDP O/A as it is done in the MediaServerClient and firefox will fail
		if (this.pc.signalingState!="have-local-offer")
		{
			//Create offer
			const offer = await this.pc.createOffer();
			
			//Get sdp
			let sdp = offer.sdp;

			//HACK: SDP mungling and codec enforcement
			if (!this.strictW3C)
			{
				//Update offer
				sdp = fixLocalSDP(sdp,transceivers);
				//If we are forcing sdp mungling we can't pass simulcast stuff into the local offer
				if (this.forceSDPMunging)
					//Do not pass simulcast into  local sdp
					offer.sdp = sdp
						.replace(/a=simulcast(.*)\r\n/,"")
						.replace(/a=rid(.*)\r\n/,"");
				else
					//Update offer
					offer.sdp = sdp;
			}
			
			//Set local description
			await this.pc.setLocalDescription(offer);
			
			//HACK: for firefox
			if (!this.strictW3C)
				//Check if we need to convert to simulcast-03 the answer
				simulcast03 = offer.sdp.indexOf(": send rid=")!=-1;

			//HACK: Firefox uses old simulcast so switch back
			const sdpInfo = simulcast03 ? offer.sdp.replace(": send rid=",":send ") : sdp;
			
			//Parse local info 
			this.localInfo = SDPInfo.parse(sdpInfo);
		} else {
			//HACK: for firefox. Check if we need to convert to simulcast-03 the answer
			simulcast03 = (this.pc.pendingLocalDescription || this.pc.currentLocalDescription).sdp.indexOf(": send rid=")!=-1;
		}
		
		//Get remote sdp
		this.remoteInfo = this.localInfo.answer(this.remote);
		
		//For all transceivers
		for (const transceiver of this.pc.getTransceivers())
		{
			//If we have to override the codec
			if (transceiver.codecs && transceiver.mid)
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
				//Reset codecs
				cloned.codecs = [];
				//For each transceiver codec
				for (const codec of transceiver.codecs)
					//For
					for (const supported of capabilities.codecs)
						//If it is the same ignoring parameters
						if (codec.toLowerCase()===supported.split(";")[0].toLowerCase())
							//Add to cloned codecs
							cloned.codecs.push(supported);
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
				const trackInfo = this.localInfo.getTrackByMediaId(mid);
				//signal it
				this.ns.event("addedtrack",{
					streamId	: transceiver.sender.streamId,
					track		: trackInfo.plain()
				});
				//Store in transceiverç
				transceiver.sender.trackInfo = trackInfo;
			} else if (transceiver.direction==="recvonly") {
				//Get mid
				const mid = transceiver.mid;
				//Get track
				const trackInfo = transceiver.trackInfo;
				//Assing
				trackInfo.setMediaId(mid);
			} else if (transceiver.direction==="inactive" &&  transceiver.sender && transceiver.sender.trackInfo) {
				//Get mid
				const mid = transceiver.mid;
				//signal it
				this.ns.event("removedtrack",{
					streamId	: transceiver.sender.streamId,
					trackId		: transceiver.sender.trackInfo.getId()
				});
				//Delete stuff
				delete(transceiver.sender.streamId);
				delete(transceiver.fixSimulcastEncodings);
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
		
		//Create remote sdp
		let sdp =  this.remoteInfo.toString();
		
		//If forcing sdp munging
		if (this.forceSDPMunging)
			//Remove all simulcast stuff from sdp
			sdp = sdp
				.replace(/a=simulcast(.*)\r\n/,"")
				.replace(/a=rid(.*)\r\n/,"");
			
		//Hack for firefox
		if (simulcast03)
			//Use old simulcast format used by firefos
			sdp = sdp.replace(":recv ",": recv rid=");
		
		//Set it
		await this.pc.setRemoteDescription({
			type	: "answer",
			sdp	: sdp
		});
		
		//Procces pending transceivers again
		for (let transceiver of processing)
			//Delete flag
			delete(transceiver.pending);
		
		//We are not renegotiting
		this.renegotiating = false;
		
		//If there are new pending
		if (this.pending.size || this.removing.size || this.adding.size)
			//Renegotiate again
			this.renegotiate();
	}

	getStats(selector)
	{
		return this.pc.getStats(selector);
	}
	
	async addTrack(track,stream,params)
	{
		let transceiver;
		//Flag to force a renegotition
		let force = this.forceRenegotiation;
		//Get send encodings
		const sendEncodings = params && params.encodings || [];
		
		try {
			//Create new transceiver
			transceiver = this.pc.addTransceiver(track,{
				direction	: "sendonly",
				streams		: stream ? [stream] : [],
				sendEncodings	: !this.forceSDPMunging ? sendEncodings : undefined
			});
		} catch (e) {
			//HACK: old crhome
			if (this.strictW3C)
				//Retrow
				throw e;
			
			//New chrome launch exception when multiple send encofings are used, so create without them and fix them later
			transceiver = this.pc.addTransceiver(track,{
				direction	: "sendonly",
				streams		: stream ? [stream] : []
			});
		}
		
		//Add track to sender
		transceiver.sender.streamId = stream ? stream.id : "-";
		
		//Hack for firefox as it doesn't support enabling simulcast on addTransceiver but on sender.setParameters
		if (!this.strictW3C) try { 
			//If doing simulcast
			if (sendEncodings.length)
			{
				//Set simuclast stuff for firefox
				await transceiver.sender.setParameters({encodings: sendEncodings});
				//Force renegotiation as event will have trigger before the event
				force = true;
			}
		} catch(e) {
		}
		
		//HACK: SDP mungling && codec override
		if (!this.strictW3C)
		{
			//Get send params
			const sendParameters = transceiver.sender.getParameters();
			//Check if we need to fix simulcast info
			if (sendParameters.encodings)
			{
				//Ifwe could not set the encoding parameters yet 
				if (sendParameters.encodings.length !==sendEncodings.length)
					//Fix them later
					transceiver.fixSimulcastEncodings = sendEncodings;
				else
					//We won't do munging even if requested (i.e. for firefox)
					this.forceSDPMunging = false;
			}
			
		}
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
	
	close()
	{	
		//Stop peerconnection
		this.pc.close();
		//Close namespace
		this.ns.close();
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
	let fixed = sdp.substr(0,ini!==-1 ? ini+2 : ini);

	//Check if each media info has the appropiate simulcast info
	for (const transceiver of transceivers)
	{
		//Find next m line
		let end = sdp.indexOf("\r\nm=",ini+4);
		//Get m line
		let media = sdp.substring(ini+2,end!==-1 ? end+2  : undefined);
		//Move to next
		ini = end;

		//Check if we need to fix the simuclast info
		const fixSimulcastEncodings = transceiver.fixSimulcastEncodings ? transceiver.fixSimulcastEncodings.sort((a,b)=>{ return (b.scaleResolutionDownBy||1) - (a.scaleResolutionDownBy||1);}) : null;

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
		
		if (fixed.indexOf("\r\n\r\n")!=-1)
			throw fixed;
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
