# Medooze Media Server Client
This client libray alllows to easily connect to [the Medooze Media Server](https://github.com/medooze/media-server-node) with a simple API.

## Features
- Automatically sets Unified Plan SDP semantics for chrome
- Automatically creates a new server side Transport object when a new managed PeerConnection is created by the client
- Performs SDP offer/answer when a new track is added or removed in either client or server side
- Synchronizes stream and tracks in client and server, creating and deleting them as appropiate
- Perform SDP mangling for enabling simulcast in Chrome

 ## Demo
 You can find a demo in the `demo` directory. To run it just do:
 
 ```
 npm i
 npm run-script dist
 cd demo
 npm i
 npm indes.js <your ip address>
 ```
 
## Usage

In order to connect with the server you will need to connect via websocket and open a new transaction manager:

```
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
};
 ```
 
 Server side you will have to be listening for new clients by using the PeerConnectionserver:
 
 ```
const connection = request.accept(protocol);

//Create new transaction manager
const tm = new TransactionManager(connection);
			
//Create new managed peerconnection server for this
const mngr = endpoint.createPeerConnectionServer(tm,Capabilities);
	
//LIsten for remotelly created peer connections
mngr.on("transport",(transport)=>{
  //Here you will get the transport associated to the PeerConnection created in client.createManagedPeerConnection()
});
 ```
 
Once you have both the managed peerconnection client and the server transport created you can add tracks in either side, for example if you do it in the browser:

```
//Browser
const sender = await pc.addTrack(track,stream);
```

Will trigger the `incomingtrack` event on the server transport.

```
//Server 
transport.on("incomingtrack",(track,stream)=>{});
  
```

And vice versa, a track added in the transport

```
//Crete empty stream
transport.createOutgoingStream(outgoingStreamId);
			
//Create ougoing track
const outgoing = outgoingStream.createTrack("video");
```

Will trigger the `ontrack` event on the managed peer connection on the browser:

```
//Event handler
pc.ontrack = (event) => console.log(event);
```

Similarily, removing the tracks on browser or stopping the tracks on the server, will trigger the appropiate event on the other side.
 
## API

### MediaServerClient
Factory object used to synchronze with the server.

#### constructor( [transactionManager](https://github.com/medooze/transaction-manager) )
Creates a new client object.

- `transactionManager` A transaction manager connected with the server (see [TransactionManager](https://github.com/medooze/transaction-manager) for more info).
    
#### Promise<PeerConnectionClient> createManagedPeerConnection(options)
Creates a new managed peer connection client object. 
	
- `options` Same options allowed on the [PeerConnection configuration dictionary](https://www.w3.org/TR/webrtc/#rtcconfiguration-dictionary).

This will create a new Transport object on the server.

### PeerConnectionClient

#### Promise< RTCSender > addTrack(track,stream,encodings)

Adds a new track to the client and creates a new IncomingStreamTrack (and IncomingStream if needed) server side.
- `track`  The track to send
- `stream`  The stream to send
- `encodings`  A array of [RTCRtpEncodingParameters](https://www.w3.org/TR/webrtc/#dom-rtcrtpencodingparameters) which can be used for enabling simulcast. If the encodings array is provided it will be set accordingly on the transcevier (on the sender.setParameters if on Firefox) and if it is not supported, it will mangle the SDP for chrome adding the required ssrcs to enable simulcast
    
#### void removeTrack(sender)

Stops sending the track, will stop the IncomingStreamTrack server side also.

- `sender` The RTCSender returned on the addTrack
    
#### Promise< RTCStatsReport > getStats(selector)
 
Proxy for [TCPeerConnection getStats](https://www.w3.org/TR/webrtc/#dom-rtcpeerconnection-getstats).
 
- `selector` See [RTCPeerConnection getStats](tps://www.w3.org/TR/webrtc/#dom-rtcpeerconnection-getstats)
    
#### void stop()
Closes local peerconnection and remote transport

#### attribute EventHandler ontrack
  
Proxy for the [RTCPeerConnection ontrack event handler](https://www.w3.org/TR/webrtc/#dom-rtcpeerconnection-ontrack).
 
#### attribute EventHandler ontrackended
  
Event handler for the new ontrackended event. The event fired will be an [RTCTrackEvent](https://www.w3.org/TR/webrtc/#dom-rtctrackevent) with event name `trackended`.
 
#### attribute EventHandler onstatsended
  
Proxy for the [RTCPeerConnection onstatsended event handler](https://www.w3.org/TR/webrtc/#dom-rtcpeerconnection-onstatsended).
  
## Install
  
Just create a js bundle and link it in your web app.
```
npm i
npm run-script dist
```
The js file will be located on the `dist` directory. Note that you will also need to use the [Transaction Manager library](https://github.com/medooze/transaction-manager).
 
 ## Author
 Sergio Garcia Murillo
 
 ## License
 MIT
