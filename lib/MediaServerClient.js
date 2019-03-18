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

		//Add sendonly transceivers for getting full codec capabilities
		const audio = pc.addTransceiver("audio",{direction: "sendonly"});
		const video = pc.addTransceiver("video",{direction: "sendonly"});
		
		//Hack for firefox to retrieve all the header extensions
		try { await video.sender.setParameters({encodings: [{ rid: "a"},{ rid: "b" , scaleResolutionDownBy: 2.0 }]}); } catch(e) {}
		
		//Create offer
		const offer = await pc.createOffer();
		
		//Parse local info
		const localInfo = SDPInfo.parse(offer.sdp.replace(": send rid=",":send "));
		
		//Set local description
		await pc.setLocalDescription(offer);
		
		//Connect
		const remote = await this.ns.cmd("create",localInfo.plain());
		
		//Get peer connection id
		const id = remote.id;
		//Create namespace for pc
		const pcns = this.tm.namespace("medooze::pc::"+id);
		
		//create new managed pc client
		return new PeerConnectionClient({
			id		: id,
			ns		: pcns,
			pc		: pc,
			remote		: remote,
			localInfo	: localInfo
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
