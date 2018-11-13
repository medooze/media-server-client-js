const PeerConnectionClient = require("./PeerConnectionClient.js");
const SemanticSDP = require("semantic-sdp");
const SDPInfo = SemanticSDP.SDPInfo;


class MediaServerClient
{
	constructor(tm)
	{
		//Crete namespace for us
		this.tm = tm;
		this.ns = tm.namespace("medooze::pc");
		
		//LIsten evens
		this.ns.on("event",(event)=>{
			//Check event name
			switch(event.name)
			{
				case "stopped":
					//Stopp us
					this.stop();
					break;
			}
		});
	}
	
	async createManagedPeerConnection(options)
	{
		//Check if running
		if (!this.ns)
			//Error
			throw new Error("MediaServerClient is closed");
		
		//Clone
		const cloned = new Object(options);
		//Add unified plan flag for chrome
		cloned.sdpSemantics = "unified-plan";
		//Create new peer connection
		const pc = new RTCPeerConnection(cloned);

		//Add reconly transceivers for getting full codec capabilities
		pc.addTransceiver("audio",{direction: "inactive"});
		pc.addTransceiver("video",{direction: "inactive"});
		
		//Create offer
		const offer = await pc.createOffer();
		
		//Set local description
		await pc.setLocalDescription(offer);
		
		//Parse local info
		const localInfo = SDPInfo.parse(offer.sdp);
		
		//Connect
		const remote = await this.ns.cmd("create",localInfo.plain());
		
		//Get remote sdp
		const remoteInfo = localInfo.answer(remote);
		
		//Set it
		await pc.setRemoteDescription({
			type	: "answer",
			sdp	: remoteInfo.toString() 
		});
		//Get peer connection id
		const id = remote.id;
		
		//Create namespace for pc
		const pcns = this.tm.namespace("medooze::pc::"+id);
		
		//Done
		return new PeerConnectionClient({
			id		: id,
			ns		: pcns,
			pc		: pc,
			remote		: remote
		});
	}
	
	stop()
	{
		this.ns.close();
		this.ns = null;
	}
}
MediaServerClient.SemanticSDP = SemanticSDP;

module.exports = MediaServerClient;