if (location.href.includes("https://try-not-to-haha.web.app"))
  location = "https://groupwatch.hagertech.dev/";

let videoList = [];
let tag = document.createElement("script");
let videosQueuedDisplay = document.getElementById("videosQueued");
let videoInput = document.getElementById("videoInput");
let nextVideoButton = document.getElementById("nextVideoButton");
let nextVideoButtonText = document.getElementById("nextVideoButtonText");
let editQueueButton = document.getElementById("editQueueButton");
let videoMenu = document.getElementById("videoMenu");
let playerIframe = document.getElementById("player");
let upload = document.getElementById("upload");
let startProgress = document.getElementById("startProgress");
let startValueInput = document.getElementById("startValueInput");
let endValueInput = document.getElementById("endValueInput");
let previewLinkInput = document.getElementById("previewLinkInput");
let exportButton = document.getElementById("exportButton");
let confirmExportButton = document.getElementById("confirmExportButton");
let playlistOverview = document.getElementById("playlistOverview");
let fileGenerator = document.getElementById("fileGenerator");
let overviewList = document.getElementById("overviewList");
let overviewCount = document.getElementById("overviewCount");
let bottomMenu = document.getElementById("bottom");
let waiting = false;
let jsonCount = 0;
let bypassWatchDisable = true;
let jsonItems = [];

tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName("script")[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

var player;
var preview;
function onYouTubeIframeAPIReady() {
  player = new YT.Player("player", {
    playerVars: { autoplay: 0, controls: 0, modestbranding: true },
    events: {
      onStateChange: onPlayerStateChange,
    },
  });
  preview = new YT.Player("preview", {
    playerVars: { autoplay: 0, controls: 1, modestbranding: true },
  });
  document.getElementById("player").style.height =
    window.innerHeight - bottomMenu.clientHeight + "px";
}

function Video(id, start, end) {
  this.id = id;
  this.start = start;
  this.end = end;
}

function onPlayerStateChange(event) {
  if (event.data === 0) {
    document.getElementById("playerHolder").style.display = "none";
  } else {
    document.getElementById("playerHolder").style.display = "block";
  }
}

function go() {
  if (waiting || videoList.length == 0 || !bypassWatchDisable) return;
  waiting = true;
  nextVideoButton.className = "loadButton waiting";
  startProgress.style.width = "100%";
  setTimeout(nextVideo, 2000);
}

function addVideos(jsonText) {
  let file = JSON.parse(jsonText);
  file.items.forEach((item) =>
    videoList.push(new Video(item.id, item.start, item.end))
  );
  updateVideosQueued();
}

function nextVideo() {
  if (videoList.length == 0) return;
  waiting = false;
  nextVideoButton.className = "loadButton";
  resetProgressBar();
  nextVideoButtonText.innerHTML = "Next Video";
  let index = Math.floor(Math.random() * videoList.length);

  player.loadVideoById({
    videoId: videoList[index].id,
    startSeconds: videoList[index].start,
    endSeconds: videoList[index].end,
  });
  player.playVideo();
  console.log(
    "ID: " +
      videoList[index].id +
      "\nStart: " +
      videoList[index].start +
      "\nEnd: " +
      videoList[index].end
  );

  videoList.splice(index, 1);
  updateVideosQueued();
}

upload.addEventListener("change", function () {
  var fr = new FileReader();
  fr.readAsText(this.files[0]);
  fr.onload = function () {
    addVideos(fr.result);
  };
  upload.value = "";
});

function getId(link) {
  let x = link;
  x = x
    .replaceAll("/", " ")
    .replaceAll("=", " ")
    .replaceAll("&", " ")
    .replaceAll("?", " ");
  x = x.split(" ");

  for (i = 0; i < x.length; i++) {
    if (x[i].length == 11) return x[i];
  }
  return -1;
}

function updateVideosQueued() {
  if (videoList.length == 1)
    videosQueuedDisplay.innerHTML = videoList.length + " video queued";
  else videosQueuedDisplay.innerHTML = videoList.length + " videos queued";
  if (videoList.length > 0) nextVideoButton.className = "loadButton";
  else nextVideoButton.className = "loadButton disabled";
}
updateVideosQueued();

function resetProgressBar() {
  startProgress.style.transitionDuration = "0s";
  startProgress.style.width = "0";
  setTimeout(function () {
    startProgress.style.transitionDuration = "2s";
  }, 100);
}

function previewVideo() {
  preview.loadVideoById({
    videoId: getId(previewLinkInput.value),
    startSeconds: parseFloat(startValueInput.value),
    endSeconds: parseFloat(endValueInput.value),
  });
}

function sOrNah(x) {
  if (x == 1) return "";
  else return "s";
}

function addToJsonFile() {
  let id = getId(previewLinkInput.value);
  if (id == -1) return;

  let start = parseFloat(startValueInput.value);
  let end = parseFloat(endValueInput.value);
  if (startValueInput.value == "") start = 0;
  if (endValueInput.value == "") end = -1;

  jsonItems.push(new Video(id, start, end));

  exportButton.disabled = false;
  if (confirmExportButton) confirmExportButton.disabled = false;
  jsonCount++;
  exportButton.innerHTML =
    "Export Playlist (" + jsonCount + " video" + sOrNah(jsonCount) + ")";

  previewLinkInput.value = "";
  startValueInput.value = "";
  endValueInput.value = "";
}

function finishJsonFile() {
  let jsonData =
    '{\n\t"items": [\n' +
    jsonItems
      .map((item) => generateJsonItem(item.id, item.start, item.end))
      .join(",\n") +
    "\n\t]\n}";
  downloadFile("New Playlist.groupwatch", jsonData);
  hidePlaylistOverview();
}

function generateJsonItem(id, start, end) {
  if (startValueInput.value == "") start = 0;
  if (endValueInput.value == "") end = -1;
  return (
    '\t\t{\n\t\t\t"id": "' +
    id +
    '",\n\t\t\t"start": ' +
    start +
    ',\n\t\t\t"end": ' +
    end +
    "\n\t\t}"
  );
}

function downloadFile(filename, text) {
  var element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text)
  );
  element.setAttribute("download", filename);
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

document.addEventListener("keydown", (event) => {
  if (event.isComposing || event.keyCode === 229) {
    return;
  }
  if (event.key == "n") {
    nextVideoButton.click();
  }
});

function getPreviewTime() {
  var num = preview.getCurrentTime();
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function showPlaylistOverview() {
  if (jsonItems.length == 0) return;

  renderPlaylistOverview();
  fileGenerator.style.display = "none";
  playlistOverview.style.display = "grid";
}

function hidePlaylistOverview() {
  playlistOverview.style.display = "none";
  fileGenerator.style.display = "grid";
}

function renderPlaylistOverview() {
  overviewCount.innerHTML =
    jsonItems.length + " clip" + sOrNah(jsonItems.length);

  overviewList.innerHTML = "";
  jsonItems.forEach((clip, index) => {
    let item = document.createElement("li");
    item.className = "overviewListChild";

    let start = clip.start;
    let end = clip.end;
    let endText = end == -1 ? "end of video" : end + "s";

    item.innerHTML =
      "#" +
      (index + 1) +
      " | " +
      clip.id +
      " | Start: " +
      start +
      "s | End: " +
      endText;
    overviewList.appendChild(item);
  });
}
