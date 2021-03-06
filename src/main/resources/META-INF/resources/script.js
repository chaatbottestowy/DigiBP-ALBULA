const video = document.getElementById('video')
var setUp = true
var url="https://docs.google.com/spreadsheets/d/1hZ8hSMVrYOTRgKt57JnVF_cJR7W986TOV_TzKLGW990/edit?usp=sharing";
var endpoint = "https://digibp-albula01.herokuapp.com/rest/process-definition/key/Hospital_birthgiving_process/start"
var labels = []
var toRecognize = []
var faceMatcher;
function showInfo(data, tabletop) {
  for (i = 0; i<data.length; i++){
    //console.log(data[0]["First Name"])
    label = data[i]["First Name"] + " "+ data[i]["Last Name"]
    path = data[i]["Path"]
    id = data[i]["Patient ID"]
    label = label + "_" + path + "_" + id
    if (!labels.includes(label) && (path!="")){
      labels.push(label)
      toRecognize.push(label.split("_")[0])
      }
  }
  console.log("fetching new data...")
  if (setUp){
    console.log("set up once")
    startVideo()
    setUp = false
  }
  return false
}
// URL of the public spreadsheet
Promise.all([
  faceapi.nets.faceRecognitionNet.loadFromUri('./models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('./models'),
  faceapi.nets.ssdMobilenetv1.loadFromUri('./models'),
  faceapi.nets.tinyFaceDetector.loadFromUri('./models'),
  Tabletop.init({key: url, callback: showInfo, simpleSheet: true})
])

async function startVideo() {
  const labeledFaceDescriptors = await loadLabeledImages(labels);
  navigator.getUserMedia(
    { video: {} },
    stream => video.srcObject = stream,
    err => console.error(err)
  )
  start(labeledFaceDescriptors)
}
function start(labeledFaceDescriptors) {
  labeledFaceDescriptors = labeledFaceDescriptors.filter(function (el) {
    return el != null;
  });
  faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.65)
  updateLabels()

  //console.log("starting ...")
  video.addEventListener('play', () => {
    const canvas = faceapi.createCanvasFromMedia(video)
    document.body.append(canvas)
    const displaySize = { width: video.width, height: video.height }
    faceapi.matchDimensions(canvas, displaySize)
    setInterval(async () => {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors()
    const resizedDetections = faceapi.resizeResults(detections, displaySize)
    const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor))
    results.forEach((result, i) => {
      const box = resizedDetections[i].detection.box
      //console.log(result)
      //if (result.toString() in labels){alert("patient found")}
      const name = result.toString().split("_")[0]
      nameWithLabel = labels.find(element => element.includes(name.split(" (")[0]));
      if (toRecognize.includes(name.split(" (")[0])){
        toRecognize.splice(toRecognize.indexOf(name.split(" (")[0]), 1 );
        var path = nameWithLabel.split("_")[1]
        //if (path =="Green" || path =="Red"){
        var id = nameWithLabel.toString().split("_")[2]
        console.log(path,id)
        var data = 
        {
            variables: {
                pathway: {
                    value: path,
                    type: "String"
                },
                patientID: {
                    value: id,
                    type: "Long"
                }
            },
            businessKey: ""
        }        
        var xhr = new XMLHttpRequest();
        xhr.open("POST", endpoint, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        var data = JSON.stringify(data)
        xhr.send(data); 
  //  }
  }
      //console.log(result.toString())
      //console.log(name)
      const drawBox = new faceapi.draw.DrawBox(box, { label: name.split(" (")[0] })
      drawBox.draw(canvas)
    })
  },100)
})
}
function loadLabeledImages(labels) {
  return Promise.all(
    labels.map(async label => {
      if (label){
      const descriptions = []
      label = label.split("_")[0]
      const img = await faceapi.fetchImage(`./dbImages/${label}.jpg`).catch(err => {return})
      if(img){
      const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor()
      descriptions.push(detections.descriptor)
      return new faceapi.LabeledFaceDescriptors(label, descriptions)
      }else{return null}
    }
    })
  )
}
function updateLabels(){
  setInterval(async () => {
  Tabletop.init({key: url, callback: showInfo, simpleSheet: true})
  labeledFaceDescriptors = await loadLabeledImages(labels);
  labeledFaceDescriptors = labeledFaceDescriptors.filter(function (el) {
    return el != null;
  });
  faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6)
  },1000)
  return false
}
