const firebaseConfig = {
  apiKey: "AIzaSyAV2-bOqQUsSk45RqmeeazxxLuqyEGpV1w",
  authDomain: "za-bingo-7ad31.firebaseapp.com",
  databaseURL: "https://za-bingo-7ad31-default-rtdb.firebaseio.com",
  projectId: "za-bingo-7ad31",
  storageBucket: "za-bingo-7ad31.firebasestorage.app",
  messagingSenderId: "713392974772",
  appId: "1:713392974772:web:0e14359197fd522c06a0e1",
  measurementId: "G-40RYH7BT4C"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();
const functionsRef = firebase.functions();

let currentUser = null;
let currentRoomId = null;
let currentCartelaIds = [];

let gameState = {
  status: null,
  calledNumbers: [],
  currentNumber: null,
  winner: null,
  prizePool: 0,
  playersInRoom: {},
};

let listeners = {};

function setListener(key, unsubscribe) {
  if (listeners[key]) listeners[key]();
  listeners[key] = unsubscribe;
}

function clearListener(key) {
  if (listeners[key]) listeners[key]();
  delete listeners[key];
}

function clearAllListeners() {
  Object.keys(listeners).forEach(key => {
    if (listeners[key]) listeners[key]();
  });
  listeners = {};
}