"use client";

import { useState, useRef, useEffect } from "react";

export default function Home() {
  // State for the chat UI
  const [messages, setMessages] = useState<
    { text: string; sender: "me" | "peer" }[]
  >([]);
  const [inputMessage, setInputMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State for WebRTC handling
  const [offerSDP, setOfferSDP] = useState("");
  const [answerSDP, setAnswerSDP] = useState("");
  const [isInitiator, setIsInitiator] = useState<boolean | null>(null);

  // WebRTC references
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  // Check if WebRTC is supported
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!window.RTCPeerConnection) {
        setErrorMessage("Your browser doesn't support WebRTC");
        setConnectionStatus("Error: WebRTC not supported");
      }
    }
  }, []);

  // Function to initialize a connection as the initiator (creates an offer)
  const createOffer = async () => {
    try {
      setIsInitiator(true);
      setConnectionStatus("Creating peer connection...");
      setErrorMessage(null);

      // Create the peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // Create data channel
      const dataChannel = peerConnection.createDataChannel("chat");
      setupDataChannel(dataChannel);
      dataChannelRef.current = dataChannel;

      // Set a timeout to finalize the offer if no null candidate is received
      const iceTimeoutId = setTimeout(() => {
        if (
          peerConnection.iceGatheringState !== "complete" &&
          peerConnectionRef.current
        ) {
          console.log("ICE gathering timed out, using current SDP");
          const sdp = peerConnection.localDescription?.sdp || "";
          if (sdp && !offerSDP) {
            console.log("Setting final SDP offer from timeout:", sdp);
            setOfferSDP(sdp);
            setConnectionStatus("Offer created. Share this with your peer.");
          }
        }
      }, 5000); // 5 second timeout

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        console.log("ICE candidate:", event.candidate);
        if (event.candidate === null) {
          // We've collected all our ICE candidates, update the offer SDP
          clearTimeout(iceTimeoutId);
          const sdp = peerConnection.localDescription?.sdp || "";
          console.log("Final SDP offer:", sdp);
          setOfferSDP(sdp);
          setConnectionStatus("Offer created. Share this with your peer.");
        }
      };

      peerConnection.onicegatheringstatechange = () => {
        console.log("ICE gathering state:", peerConnection.iceGatheringState);
        if (peerConnection.iceGatheringState === "complete") {
          clearTimeout(iceTimeoutId);
          if (!offerSDP) {
            const sdp = peerConnection.localDescription?.sdp || "";
            console.log("Final SDP offer from state change:", sdp);
            setOfferSDP(sdp);
            setConnectionStatus("Offer created. Share this with your peer.");
          }
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", peerConnection.iceConnectionState);
      };

      // Create offer
      const offer = await peerConnection.createOffer();
      console.log("Created offer:", offer);
      await peerConnection.setLocalDescription(offer);
      peerConnectionRef.current = peerConnection;
    } catch (error) {
      console.error("Error creating offer:", error);
      setConnectionStatus("Error creating offer");
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  // Function to accept an offer and create an answer
  const createAnswer = async () => {
    if (!offerSDP) {
      setConnectionStatus("Please paste an offer first");
      return;
    }

    try {
      setIsInitiator(false);
      setConnectionStatus("Creating peer connection...");
      setErrorMessage(null);

      // Create the peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // Handle data channel
      peerConnection.ondatachannel = (event) => {
        console.log("Data channel received:", event.channel);
        setupDataChannel(event.channel);
        dataChannelRef.current = event.channel;
      };

      // Set a timeout to finalize the answer if no null candidate is received
      const iceTimeoutId = setTimeout(() => {
        if (
          peerConnection.iceGatheringState !== "complete" &&
          peerConnectionRef.current
        ) {
          console.log("ICE gathering timed out, using current SDP");
          const sdp = peerConnection.localDescription?.sdp || "";
          if (sdp && !answerSDP) {
            console.log("Setting final SDP answer from timeout:", sdp);
            setAnswerSDP(sdp);
            setConnectionStatus("Answer created. Share this with your peer.");
          }
        }
      }, 5000); // 5 second timeout

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        console.log("ICE candidate:", event.candidate);
        if (event.candidate === null) {
          // We've collected all our ICE candidates, update the answer SDP
          clearTimeout(iceTimeoutId);
          const sdp = peerConnection.localDescription?.sdp || "";
          console.log("Final SDP answer:", sdp);
          setAnswerSDP(sdp);
          setConnectionStatus("Answer created. Share this with your peer.");
        }
      };

      peerConnection.onicegatheringstatechange = () => {
        console.log("ICE gathering state:", peerConnection.iceGatheringState);
        if (peerConnection.iceGatheringState === "complete") {
          clearTimeout(iceTimeoutId);
          if (!answerSDP) {
            const sdp = peerConnection.localDescription?.sdp || "";
            console.log("Final SDP answer from state change:", sdp);
            setAnswerSDP(sdp);
            setConnectionStatus("Answer created. Share this with your peer.");
          }
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", peerConnection.iceConnectionState);
      };

      // Set the remote description (the offer)
      const offer = new RTCSessionDescription({
        type: "offer",
        sdp: offerSDP,
      });

      await peerConnection.setRemoteDescription(offer);

      // Create answer
      const answer = await peerConnection.createAnswer();
      console.log("Created answer:", answer);
      await peerConnection.setLocalDescription(answer);

      peerConnectionRef.current = peerConnection;
    } catch (error) {
      console.error("Error creating answer:", error);
      setConnectionStatus("Error creating answer");
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  // Function to accept an answer
  const acceptAnswer = async () => {
    if (!answerSDP || !peerConnectionRef.current) {
      setConnectionStatus(
        "Please paste an answer and ensure you've created an offer"
      );
      return;
    }

    try {
      setConnectionStatus("Accepting answer...");
      setErrorMessage(null);

      // Set the remote description (the answer)
      const answer = new RTCSessionDescription({
        type: "answer",
        sdp: answerSDP,
      });

      await peerConnectionRef.current.setRemoteDescription(answer);
      setConnectionStatus("Connection established!");
    } catch (error) {
      console.error("Error accepting answer:", error);
      setConnectionStatus("Error accepting answer");
      setErrorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  // Setup for data channel
  const setupDataChannel = (dataChannel: RTCDataChannel) => {
    console.log("Setting up data channel:", dataChannel.label);

    dataChannel.onopen = () => {
      console.log("Data channel opened");
      setConnectionStatus("Connected! You can now chat.");
    };

    dataChannel.onclose = () => {
      console.log("Data channel closed");
      setConnectionStatus("Disconnected");
    };

    dataChannel.onmessage = (event) => {
      console.log("Message received:", event.data);
      setMessages((prev) => [...prev, { text: event.data, sender: "peer" }]);
    };

    dataChannel.onerror = (error) => {
      console.error("Data channel error:", error);
      setErrorMessage(`Data channel error: ${error.toString()}`);
    };
  };

  // Function to send a message
  const sendMessage = () => {
    if (
      !inputMessage.trim() ||
      !dataChannelRef.current ||
      dataChannelRef.current.readyState !== "open"
    ) {
      return;
    }

    // Add to local messages
    setMessages((prev) => [...prev, { text: inputMessage, sender: "me" }]);

    // Send to peer
    dataChannelRef.current.send(inputMessage);
    console.log("Message sent:", inputMessage);

    // Clear input
    setInputMessage("");
  };

  // Reset the connection
  const resetConnection = () => {
    // Close existing connection
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    // Reset state
    setOfferSDP("");
    setAnswerSDP("");
    setIsInitiator(null);
    setConnectionStatus("Disconnected");
    setErrorMessage(null);
    peerConnectionRef.current = null;
    dataChannelRef.current = null;
  };

  // Manually trigger ICE candidate generation (workaround for some browsers)
  const forceTriggerICE = () => {
    if (!peerConnectionRef.current) return;

    // Add a dummy data channel to force ICE candidate generation
    try {
      const dummyChannel = peerConnectionRef.current.createDataChannel("dummy");
      setTimeout(() => {
        dummyChannel.close();
      }, 100);
    } catch (error) {
      console.error("Error forcing ICE candidates:", error);
      console.log("Dummy channel not needed");
    }
  };

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">WebRTC Chat</h1>

      {/* Connection Status */}
      <div className="mb-6 p-4 bg-gray-100 rounded">
        <p className="font-bold">
          Status:{" "}
          <span
            className={
              connectionStatus === "Connected! You can now chat."
                ? "text-green-600"
                : "text-orange-500"
            }
          >
            {connectionStatus}
          </span>
        </p>
        {errorMessage && <p className="text-red-500 mt-2">{errorMessage}</p>}
        {(connectionStatus.includes("Creating") ||
          connectionStatus.includes("Offer created")) && (
          <div className="mt-2 p-2 border border-orange-300 bg-orange-50 rounded">
            <p className="font-medium text-orange-800 mb-1">
              ICE gathering in progress...
            </p>
            <button
              onClick={forceTriggerICE}
              className="px-3 py-1.5 bg-orange-500 text-white rounded hover:bg-orange-600 font-medium"
            >
              Force Complete ICE Gathering
            </button>
            <p className="text-sm mt-1 text-orange-700">
              If offer/answer is stuck at "Creating...", click this button to
              manually complete the ICE gathering process
            </p>
          </div>
        )}
      </div>

      {/* Connection Setup */}
      {isInitiator === null && (
        <div className="flex gap-4 mb-6">
          <button
            onClick={createOffer}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create Offer (Start Connection)
          </button>
          <button
            onClick={() => setIsInitiator(false)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Accept Offer (Join Connection)
          </button>
        </div>
      )}

      {/* Offer/Answer Exchange */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {isInitiator === true && (
          <div className="p-4 border rounded">
            <h2 className="text-xl font-bold mb-2">Your Offer</h2>
            <p className="mb-2 text-sm">Share this offer with your peer:</p>
            <textarea
              value={offerSDP}
              readOnly
              className="w-full p-2 border rounded h-40 font-mono text-sm bg-gray-50"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />

            <h2 className="text-xl font-bold mb-2 mt-4">Paste Answer</h2>
            <textarea
              value={answerSDP}
              onChange={(e) => setAnswerSDP(e.target.value)}
              className="w-full p-2 border rounded h-40 font-mono text-sm"
              placeholder="Paste the answer SDP here..."
            />
            <button
              onClick={acceptAnswer}
              disabled={!answerSDP}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              Accept Answer
            </button>
          </div>
        )}

        {isInitiator === false && (
          <div className="p-4 border rounded">
            <h2 className="text-xl font-bold mb-2">Paste Offer</h2>
            <textarea
              value={offerSDP}
              onChange={(e) => setOfferSDP(e.target.value)}
              className="w-full p-2 border rounded h-40 font-mono text-sm"
              placeholder="Paste the offer SDP here..."
            />
            <button
              onClick={createAnswer}
              disabled={!offerSDP}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              Create Answer
            </button>

            {answerSDP && (
              <>
                <h2 className="text-xl font-bold mb-2 mt-4">Your Answer</h2>
                <p className="mb-2 text-sm">
                  Share this answer with your peer:
                </p>
                <textarea
                  value={answerSDP}
                  readOnly
                  className="w-full p-2 border rounded h-40 font-mono text-sm bg-gray-50"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Reset Button */}
      <div className="mb-6">
        <button
          onClick={resetConnection}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Reset Connection
        </button>
      </div>

      {/* Chat Interface */}
      <div className="border rounded overflow-hidden">
        {/* Messages */}
        <div className="h-80 p-4 overflow-y-auto bg-gray-50">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-center my-10">No messages yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`p-2 rounded max-w-[80%] ${
                    msg.sender === "me"
                      ? "bg-blue-500 text-white self-end"
                      : "bg-gray-200 self-start"
                  }`}
                >
                  {msg.text}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 p-2 border rounded"
            disabled={
              !dataChannelRef.current ||
              dataChannelRef.current.readyState !== "open"
            }
          />
          <button
            onClick={sendMessage}
            disabled={
              !dataChannelRef.current ||
              dataChannelRef.current.readyState !== "open"
            }
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
