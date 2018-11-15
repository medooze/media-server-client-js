const url = "wss://"+window.location.hostname+":"+window.location.port;

function addRemoteTrack(event)
{
	console.log(event);
	
	const track	= event.track;
	const stream	= event.streams[0];
	
	if (!stream)
		return console.log("addRemoteTrack() no stream")
	stream.oninactive = (event)=>console.log(event);
	
	//Check if video is already present
	let video = remoteVideos.querySelector("div[id='"+stream.id+"']>video");
	
	//Check if already present
	if (video)
		//Ignore
		return console.log("addRemoteTrack() video already present for "+stream.id);
	
	//Create html stuff
	const div	= document.createElement("div");
	video		= document.createElement("video");
	
	//Set id
	div.id = stream.id;
	
	//Set video source
	video.srcObject = stream;
	
	//Play it
	video.autoplay = true;
	video.play();
	
	//Add them
	div.appendChild(video);
	remoteVideos.append(div);
	
	return div;
}

function removeRemoteTrack(event)
{
	console.log(event);
	
	const track	= event.track;
	const stream	= event.streams[0];
	
	//Check if video is already present
	let div = remoteVideos.querySelector("div[id='"+stream.id+"']");
	
	//Check if already present
	if (!div)
		//Ignore
		return console.log("removeRemoteTrack() video not present for "+stream.id);
	
	remoteVideos.removeChild(div);
	
	return div;
}

function createLocalStream(i)
{
	//Create new canvs
	const canvas = document.createElement("canvas");
	//Fix width and height so encoding is not too expensive
	canvas.height = 64;
	canvas.width = 64;
	
	//Draw number
	var ctx = canvas.getContext("2d");
	
	//Periodically update it
	let num = 0;
	canvas.timer = setInterval(()=>{
		var ctx = canvas.getContext("2d");
		ctx.beginPath();
		ctx.fillStyle = "white";
		ctx.fillRect(0,0,64,64);
		ctx.fillStyle = "red";
		ctx.font = "32pt Arial";
		ctx.fillText(i,20,48);
		ctx.lineWidth = 6;
		ctx.strokeStyle = 'white';
		ctx.arc(32,32,20,0,2*Math.PI);
		ctx.stroke();
		ctx.beginPath();
		ctx.lineWidth = 4;
		ctx.strokeStyle = 'black';
		ctx.arc(32,32,20,-Math.PI/2,-Math.PI/2 + (num++%11)*Math.PI/5);
		ctx.stroke();
	},100);
	
	return canvas;
}

function addLocalStream(track,stream)
{
	//Create html stuff
	const div	= document.createElement("div");
	const video	= document.createElement("video");
	const button	= document.createElement("button");
	div.style.width = "64px";
	button.innerText= "delete"; 
	
	//Set video source (no  audio tracks in demo)
	video.srcObject = stream;
	
	//Add them
	div.appendChild(video);
	div.appendChild(button);
	localVideos.append(div);
	
	//Start playing
	video.muted = true;
	video.autoplay = true;
	video.play();
	
	return button;
}

let pc;
const AudioContext = window.AudioContext || window.webkitAudioContext;
//Start everything
window.onload=()=>{
	let streams = 0;
	
	//Connect with websocket
	const ws = new WebSocket(url);
	
	//Crete transaction manager 
	const tm = new TransactionManager(ws);
	
	//Create managed peer connection
	const client = new MediaServerClient(tm);
	
	//Start on open
	ws.onopen = async ()=>{
		
		//Create new managed pc 
		pc = await client.createManagedPeerConnection();
		
		//On new remote tracks
		pc.ontrack	= addRemoteTrack;
		pc.ontrackended = removeRemoteTrack;
		
		//Add listeneres
		addTrack.onclick = async ()=>{
			//Create new canvas
			const canvas = createLocalStream(streams++);
			//Get stream
			const stream = canvas.captureStream();
			//Get video track
			const videoTrack = stream.getVideoTracks()[0];
			
			//Create audio track
			var audioContext = new AudioContext();
			var oscilator = audioContext.createOscillator();
			var audioTrack = audioContext.createMediaStreamDestination().stream.getAudioTracks()[0];
			
			//Add to stream
			stream.addTrack(audioTrack);
			//Add local video
			const button = addLocalStream(videoTrack,stream);
			//Add to pc
			const [audioSender,videoSender] = await Promise.all([pc.addTrack(audioTrack,stream),pc.addTrack(videoTrack,stream)]);
			
			//Remove 
			button.onclick = () => {
				//Remove without  wait
				pc.removeTrack(audioSender);
				pc.removeTrack(videoSender);
				clearInterval(canvas.timer);
				localVideos.removeChild(button.parentNode);
			};
			
		};
		
		addSimulcastTrack.onclick = async ()=>{
			//Create new canvas
			const canvas = createLocalStream(streams++);
			//Get stream
			const stream = canvas.captureStream();
			//Get video track
			const videoTrack = stream.getVideoTracks()[0];
			
			//Create audio track
			var audioContext = new AudioContext();
			var oscilator = audioContext.createOscillator();
			var audioTrack = audioContext.createMediaStreamDestination().stream.getAudioTracks()[0];
			
			//Add to stream
			stream.addTrack(audioTrack);
			//Add local video
			const button = addLocalStream(videoTrack,stream);
			
			//Add to pc
			const [audioSender,videoSender] = await Promise.all([pc.addTrack(audioTrack,stream),pc.addTrack(videoTrack,stream,[
				{rid: "a"},
				{rid: "b"},
				{rid: "c"}
			])]);
			
			//Remove 
			button.onclick = () => {
				//Remove without  wait
				pc.removeTrack(audioSender);
				pc.removeTrack(videoSender);
				clearInterval(canvas.timer);
				localVideos.removeChild(button.parentNode);
			};
		};
	};
};