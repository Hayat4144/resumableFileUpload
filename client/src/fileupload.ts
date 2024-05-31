import { UploadFileChunks, generateFileId } from "./utils";
import "./manageDb"
import { addMetadata, dbDataObject, deleteMetadata, getMetaData, updateUploadedChunks } from './manageDb'


const uploadbtn = document.getElementById('uploadbtn') as HTMLButtonElement;
const upload = document.getElementById('upload') as HTMLInputElement;
const loading = document.getElementById("loading") as HTMLParagraphElement;
const errormsg = document.getElementById("error") as HTMLParagraphElement;
const stopbtn = document.getElementById("stopbtn") as HTMLButtonElement;

let uploading = false

function updateLoading(totalFileSize: number, uploadedChunks: number) {
    const percentage = Math.floor(uploadedChunks / totalFileSize * 100)
    loading.innerText = `${percentage} % has been uploaded.`
}

window.onload = function() {
    if (!upload.files?.length) {
        uploadbtn.disabled = true;
        stopbtn.disabled = true;
    }
}

if (uploading) {
    stopbtn.disabled = false
}

upload.addEventListener('change', handleFileChange);
uploadbtn.addEventListener('click', uploadFile);

stopbtn.addEventListener('click', stopuploading)

function stopuploading(e: MouseEvent) {
    e.preventDefault()
    uploading = false;
}

function handleFileChange() {
    if (!upload.files?.length) {
        uploadbtn.disabled = true;
        stopbtn.disabled = true;
        console.log('Disable the button');
    } else {
        uploadbtn.disabled = false
    }
}


function calculateUploadedChunks
    (uploadedChunks: number[], fileSize: number, chunkSize: number, totalChunks: number) {
    if (uploadedChunks.length === totalChunks) {
        const alreadyUploaded = (uploadedChunks.length - 1) * chunkSize;
        const remainingChunk = fileSize - alreadyUploaded;
        return alreadyUploaded + remainingChunk;
    }
    return uploadedChunks.length * chunkSize
}

async function uploadFile(e: MouseEvent) {
    e.preventDefault();
    uploadbtn.disabled = true;
    uploading = true;
    stopbtn.disabled = false;
    if (!upload.files?.length) {
        console.error("No file selected");
        uploadbtn.disabled = false;
        stopbtn.disabled = true;
        return;
    }


    const file = upload.files[0];
    const fileReader = new FileReader();

    const chunkSize = 10 * 1024 * 1024; // 10mb per request
    const totalChunks = Math.ceil(file.size / chunkSize);
    const fileId = await generateFileId(file);
    const fileSize = file.size;
    let totalUploaded = 0;


    let dbData: dbDataObject;


    const result = await getMetaData(fileId);
    if (!result) {
        dbData = {
            fileId,
            fileSize: fileSize.toString(),
            fileName: file.name,
            uploadedChunks: [],
            totalChunks,
        }
        addMetadata('metadata', dbData)
    } else {
        dbData = result;
    }


    fileReader.onload = async (evt) => {
        if (!evt.target?.result) {
            console.error("File reading failed");
            return;
        }
        loading.style.display = 'block';
        for (let i = dbData.uploadedChunks.length; i < totalChunks; i++) {
            if (!uploading) {
                loading.innerText = 'Uploading is stoped.'
                setTimeout(() => {
                    loading.innerText = ''
                    loading.style.display = 'none'
                }, 5000);
                console.log('uploading is stoped.')
                uploadbtn.disabled = false;
                stopbtn.disabled = true;
                break;
            }
            const chunk = (evt.target.result as ArrayBuffer).slice(chunkSize * i, chunkSize * i + chunkSize);
            const headers = {
                "chunkIndex": `${i}`,
                "fileName": file.name,
                "fileId": fileId,
                "totalChunks": totalChunks.toString(),
                "fileSize": fileSize.toString()
            };

            try {
                const result = await UploadFileChunks(headers, chunk);
                if (result.status !== 200) {
                    loading.style.display = 'none'

                    errormsg.style.display = 'block';
                    errormsg.innerText = "something went wrong.";
                    setTimeout(() => {
                        errormsg.innerText = ''
                        errormsg.style.display = 'none'
                    }, 7000);
                    console.error("Chunk upload failed", result);
                    break;
                }

                const { message, uploadedChunks } = await result.json();
                totalUploaded += chunk.byteLength;
                dbData.uploadedChunks = uploadedChunks
                updateUploadedChunks(fileId, dbData.uploadedChunks)


                if (uploadedChunks.length === totalChunks) {
                    const completedUpload = calculateUploadedChunks(uploadedChunks, fileSize, chunkSize, totalChunks);
                    updateLoading(fileSize, completedUpload)
                    deleteMetadata(fileId)
                    upload.value = '';
                    uploading = false;
                    stopbtn.disabled = true
                    setTimeout(() => {
                        loading.innerText = ''
                    }, 3000);
                } else {
                    const totalUploaded = calculateUploadedChunks(uploadedChunks, fileSize, chunkSize, totalChunks);
                    updateLoading(fileSize, totalUploaded)
                }

            } catch (error) {
                console.error("Error uploading chunk", error);
                stopbtn.disabled = true;
                loading.style.display = 'none'
                errormsg.style.display = 'block';
                errormsg.innerText = (error as any).message;
                setTimeout(() => {
                    errormsg.innerText = ''
                    errormsg.style.display = 'none'
                }, 7000);
                break;
            }
        }
    };

    fileReader.readAsArrayBuffer(file);
}

