// Helper function to generate a unique fileId
export const generateFileId = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
};


export const BASE_URL = 'http://localhost:5000';

export const UploadFileChunks = async (headers: any, chunks: ArrayBuffer) => {
    const response = await fetch(`${BASE_URL}/uploads`, {
        method: 'POST',
        headers,
        body: chunks
    })

    return response;
}

