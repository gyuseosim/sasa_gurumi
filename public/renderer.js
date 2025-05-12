import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils, VRMLookAt } from '@pixiv/three-vrm';
const chatHistory = [];
function updateChatHistory(role, message) {
    chatHistory.push({ role, message });
    const chatHistoryDiv = document.getElementById("chat-history");
    const messageWrapper = document.createElement("div");
    messageWrapper.id = (role === "Bot") ? "bot-message" : "user-message";
    const messageDiv = document.createElement("div");
    messageDiv.textContent = `${message}`;
    messageDiv.className = role;
    messageWrapper.appendChild(messageDiv);
    chatHistoryDiv.appendChild(messageWrapper);
    chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
}
let inactivityTimer;

function resetTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(onInactive, 60 * 1000);
}

function onInactive() {
    try {
        const data = {
            prompt: "hi"
        };
        fetch('/api/memory', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        })
            .then(response => { return response.json() })
            .then(result => {
                console.log(result);
            })
            .catch(error => console.error("전송 실패:", error));

    } catch (error) {
        console.error("Error:", error);
        updateChatHistory("Error", "Something went wrong. Please try again.");
    }
}
window.addEventListener("beforeunload", function (event) {
    onInactive();
});
async function sendMessage(userMessage) {
    if(!userMessage) return;
    updateChatHistory("User", userMessage);
    let botMessage = "";
    let botFeeling = "";
    let botmap = "";
    try {
        const data = {
            prompt: userMessage
        };
        fetch('/api/data', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        })
            .then(response => { return response.json() })
            .then(result => {
                botMessage = result.message;
                botFeeling = result.feeling;
                botmap = result.map;
                updateMap(botmap);
                updateChatHistory("Bot", botMessage);
                updateFeeling(botFeeling);
                speakWithVoice(botMessage, "Microsoft Heami - Korean (Korean)");
                try{
                    if(isRecording == true){
                        recognition.start();
                    }
                }catch(error){
                    setTimeout(recognition.start(), 1000);
                }
                mousespeak(botMessage);
                resetTimer();
            })
            .catch(error => console.error("전송 실패:", error));

    } catch (error) {
        console.error("Error:", error);
        updateChatHistory("Error", "Something went wrong. Please try again.");
    }
    await currentVrm.expressionManager.setValue("aa", 0);
}
function updateMap(map) {
    if(map != 0){
        document.getElementById(`floor${map}`).style.display = "block";
        setTimeout(function() {
            document.getElementById(`floor${map}`).style.display = "none";
        }, 8*1000);
    }
}
function speakWithVoice(text, voiceName) {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const selectedVoice = voices.find(voice => voice.name === voiceName);
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }
    utterance.pitch = 1.5;
    utterance.rate = 1.5;
    synth.speak(utterance);
}

const micButton = document.getElementById("mic-button");
const chatHistorys = document.getElementById("chat-history");
const userInput = document.getElementById("user-input");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let isRecording = true;
micButton.addEventListener("click", () => {
    isRecording = !isRecording;

    if (isRecording) {
        micButton.textContent = "🔴";
        try{
            recognition.start();
        } catch (error) {
            console.log("mc already started")
        }
    } else {
        micButton.textContent = "🎤";
        recognition.stop();
    }
});
const recognition = new SpeechRecognition();

recognition.continuous = true;
recognition.interimResults = false;

let voiceinactivityTimer = null;

let lastTranscript = '';

function onSilence() {
    const currentText = userInput.value.trim();
    userInput.value = '';

    sendMessage(currentText);
}

function resetInactivityTimer() {
    if (voiceinactivityTimer) clearTimeout(voiceinactivityTimer);
    voiceinactivityTimer = setTimeout(onSilence, 500);
}

recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
    }
    console.log('음성 입력:', transcript);
    userInput.value = transcript
    resetInactivityTimer();
};

recognition.start();
document.getElementById("send-button").addEventListener("click", () => {
    const userInput = document.getElementById("user-input");
    const userMessage = userInput.value.trim();
    if (userMessage) {
        sendMessage(userMessage);
        userInput.value = "";
    }
});
document
    .getElementById("user-input")
    .addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            document.getElementById("send-button").click();
        }
    });
const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true
  });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);
const camera = new THREE.PerspectiveCamera(30.0, window.innerWidth / window.innerHeight, 0.1, 20.0);
camera.position.set(0.16, 1.35, 0.8);
const controls = new OrbitControls(camera, renderer.domElement);
controls.screenSpacePanning = true;
controls.target.set(0.16, 1.35, 0.0);
controls.update();
const scene = new THREE.Scene();
const lookAtTarget = new THREE.Object3D();
camera.add(lookAtTarget);
const helperRoot = new THREE.Group();
helperRoot.renderOrder = 10000;
const light = new THREE.DirectionalLight(0xffffff, Math.PI);
light.position.set(1.0, 1.0, 1.0).normalize();
scene.add(light);
scene.background = null
let currentVrm = undefined;
let currentMixer = undefined;
const loader = new GLTFLoader();
loader.crossOrigin = 'anonymous';
loader.register((parser) => {
    return new VRMLoaderPlugin(parser, { helperRoot });
});
loader.load(
    './Model_grum.vrm',
    (gltf) => {
        const vrm = gltf.userData.vrm;
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);
        VRMUtils.combineMorphs(vrm);
        vrm.scene.rotation.y = Math.PI*1.10;
        vrm.scene.traverse((obj) => {
            obj.frustumCulled = false;
        });
        currentVrm = vrm;
        vrm.lookAt.target = lookAtTarget;
        console.log(vrm);
        scene.add(vrm.scene);
        vrm.springBoneManager.enabled = true;
    },
    (progress) =>
        (error) => console.error(error)
);

const clock = new THREE.Clock();
clock.start();
let blinkInterval = 2;
let lastBlinkTime = 0;
let isBlinking = false;
let blinkValue = 0;
let blinkSpeed = 10;
let closing = true;
let armRotation = 0;
let neckxRotation = 0;
let isneckxRotation = false;
let neckyRotation = 0;
let isneckyRotation = false;
let neckzRotation = 0;
let isneckzRotation = false;
const maxRotation = Math.PI * 0.01;
const rotationSpeed = Math.PI * 0.01;
const frequency = 0.01;
let neckxtime = 0;
let neckytime = 0;
let neckztime = 0;
let spinexRotation = 0;
let isspinexRotation = false;
let spineyRotation = 0;
let isspineyRotation = false;
let spinezRotation = 0;
let isspinezRotation = false;
let spinextime = 0;
let spineytime = 0;
let spineztime = 0;
function mousespeak(text) {
    let length = text.length;
    let time = length * 0.2;
    let intervalTime = 200;
    let repeatCount = time * 5;
    let count = 0;
    let interval = setInterval(() => {
        if (count % 2 === 0) {
            currentVrm.expressionManager.setValue("aa", 0.5);
        } else {
            currentVrm.expressionManager.setValue("aa", 0);
        }
        count++;
        if (count >= repeatCount) {
            clearInterval(interval);
        }
    }, intervalTime);
    currentVrm.expressionManager.setValue("aa", 0);
}
function updateFeeling(feeling) {
    if (feeling === "happy") {
        currentVrm.expressionManager.setValue("happy", 1);
        currentVrm.expressionManager.setValue("sad", 0);
        currentVrm.expressionManager.setValue("angry", 0);
        currentVrm.expressionManager.setValue("neutral", 0);
        currentVrm.expressionManager.setValue("surprised", 0);
        setTimeout(() => {
            currentVrm.expressionManager.setValue("happy", 0);
        }, 1000 * 20);
    } else if (feeling === "sad") {
        currentVrm.expressionManager.setValue("happy", 0);
        currentVrm.expressionManager.setValue("sad", 1);
        currentVrm.expressionManager.setValue("angry", 0);
        currentVrm.expressionManager.setValue("neutral", 0);
        currentVrm.expressionManager.setValue("surprised", 0);
        setTimeout(() => {
            currentVrm.expressionManager.setValue("sad", 0);
        }, 1000 * 20);
    } else if (feeling === "angry") {
        currentVrm.expressionManager.setValue("happy", 0);
        currentVrm.expressionManager.setValue("sad", 0);
        currentVrm.expressionManager.setValue("angry", 1);
        currentVrm.expressionManager.setValue("neutral", 0);
        currentVrm.expressionManager.setValue("surprised", 0);
        setTimeout(() => {
            currentVrm.expressionManager.setValue("angry", 0);
        }, 1000 * 20);
    } else if (feeling === "neutral") {
        currentVrm.expressionManager.setValue("happy", 0);
        currentVrm.expressionManager.setValue("sad", 0);
        currentVrm.expressionManager.setValue("angry", 0);
        currentVrm.expressionManager.setValue("neutral", 1);
        currentVrm.expressionManager.setValue("surprised", 0);
        setTimeout(() => {
            currentVrm.expressionManager.setValue("netural", 0);
        }, 1000 * 20);
    } else if (feeling === "surprised") {
        currentVrm.expressionManager.setValue("happy", 0);
        currentVrm.expressionManager.setValue("sad", 0);
        currentVrm.expressionManager.setValue("angry", 0);
        currentVrm.expressionManager.setValue("neutral", 0);
        currentVrm.expressionManager.setValue("surprised", 1);
        setTimeout(() => {
            currentVrm.expressionManager.setValue("surprised", 0);
        }, 1000 * 20);
    }
}
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();
    if (currentVrm) {
        currentVrm.update(clock.getDelta());
        const rightUpperArm = currentVrm.humanoid.getNormalizedBoneNode('rightUpperArm')
        const leftUpperArm = currentVrm.humanoid.getNormalizedBoneNode('leftUpperArm')
        const rightLowerArm = currentVrm.humanoid.getNormalizedBoneNode('rightLowerArm')
        const leftLowerArm = currentVrm.humanoid.getNormalizedBoneNode('leftLowerArm')
        if (armRotation < Math.PI * 0.36) {
            leftUpperArm.rotation.z += Math.PI * 0.09;
            rightUpperArm.rotation.z -= Math.PI * 0.09;
            leftLowerArm.rotation.z -= Math.PI * 0.001;
            rightLowerArm.rotation.z += Math.PI * 0.001;
            armRotation += Math.PI * 0.09;
        }
        const neck = currentVrm.humanoid.getNormalizedBoneNode('neck')
        if (!isneckyRotation) {
            if (neckyRotation < maxRotation) {
                const speed = rotationSpeed * (1 - Math.cos(neckytime * frequency)) / 2;;
                neck.rotation.y += speed;
                neckyRotation += speed;
                neckytime += 1;
            } else {
                if (Math.random() < 0.01) {
                    isneckyRotation = true;
                    neckytime = 0;
                }
            }
        } else {
            if (neckyRotation > -maxRotation) {
                const speed = rotationSpeed * (1 - Math.cos(neckytime * frequency)) / 2;;
                neck.rotation.y -= speed;
                neckyRotation -= speed;
                neckytime += 1;
            } else {
                if (Math.random() < 0.01) {
                    isneckyRotation = false;
                    neckytime = 0;
                }
            }
        }
        const spine = currentVrm.humanoid.getNormalizedBoneNode('spine');
        if (!isspineyRotation) {
            if (spineyRotation < maxRotation) {
                const speed = rotationSpeed * (1 - Math.cos(spineytime * frequency)) / 2;;
                spine.rotation.y += speed;
                spineyRotation += speed;
                spineytime += 1;
            } else {
                if (Math.random() < 0.01) {
                    isspineyRotation = true;
                    spineytime = 0;
                }
            }
        } else {
            if (spineyRotation > -maxRotation) {
                const speed = rotationSpeed * (1 - Math.cos(spineytime * frequency)) / 2;;
                spine.rotation.y -= speed;
                spineyRotation -= speed;
                spineytime += 1;
            } else {
                if (Math.random() < 0.01) {
                    isspineyRotation = false;
                    spineytime = 0;
                }
            }
        }

    }
    try {
        if (currentVrm.springBoneManager) {
            currentVrm.springBoneManager.update(deltaTime);
        }
    } catch (error) {
    }
    if (!isBlinking && elapsedTime - lastBlinkTime >= blinkInterval) {
        isBlinking = true;
        lastBlinkTime = elapsedTime;
        blinkValue = 0;
        closing = true;
    }
    if (isBlinking) {
        if (closing) {
            blinkValue += deltaTime * blinkSpeed;
            if (blinkValue >= 1) {
                blinkValue = 1;
                closing = false;
            }
        } else {
            blinkValue -= deltaTime * blinkSpeed;
            if (blinkValue <= 0) {
                blinkValue = 0;
                isBlinking = false;
            }
        }
        currentVrm.expressionManager.setValue("blink", blinkValue);
    }
    if (currentMixer) {
        currentMixer.update(deltaTime);
    }
    renderer.render(scene, camera);
}
animate();
window.addEventListener('mousemove', (event) => {
    lookAtTarget.position.x = 0.5 * ((event.clientX - 0.5 * window.innerWidth) / window.innerHeight);
    lookAtTarget.position.y = - 0.3 * ((event.clientY - 0.5 * window.innerHeight) / window.innerHeight);
});