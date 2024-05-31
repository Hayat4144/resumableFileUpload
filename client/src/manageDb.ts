
export let request = indexedDB.open("fileDb", 1)
export let db: IDBDatabase | null;

export interface dbDataObject {
    fileId: string,
    fileSize: string,
    fileName: string,
    totalChunks: number,
    uploadedChunks: Array<number>

}

request.onerror = (ev) => {
    console.error("Error occured while opening db", request.error?.name)
}

request.onsuccess = (ev) => {
    db = request.result;
}

request.onupgradeneeded = event => {
    db = request.result;

    const objectStore = db.createObjectStore('metadata', { keyPath: 'fileId' })

    objectStore.createIndex("fileName", "fileName", { unique: false })
    objectStore.createIndex("fileSize", "fileSize", { unique: false })
    objectStore.createIndex("fileId", "fileId", { unique: false })
    objectStore.createIndex("totalChunks", "totalChunks", { unique: false })
    objectStore.createIndex("uploadedChunks", "uploadedChunks", { unique: false })


    objectStore.transaction.oncomplete = (ev) => {
    }
}

export function addMetadata(store: string, data: object) {

    const transaction = db?.transaction([store], 'readwrite');
    if (!transaction) return;

    transaction.onerror = function(event) {
        console.error('Transaction not opened due to error:', transaction?.error);
    };


    const objectStore = transaction.objectStore(store);

    const request = objectStore.add(data);


    request.onerror = function(event) {
        console.error('Error adding item to the store:', request.error?.name);
    };
}

export function updateUploadedChunks(fileId: string, uploadedChunks: Array<any>) {
    if (!db) return;
    const transaction = db.transaction(['metadata'], 'readwrite');


    transaction.onerror = function(event) {
        console.error('Transaction not opened due to error:', transaction.error);
    };

    const objectStore = transaction.objectStore('metadata');
    const getRequest = objectStore.get(fileId);


    getRequest.onsuccess = function(event) {
        const data = getRequest.result;

        if (data) {
            data.uploadedChunks = uploadedChunks;

            const updateRequest = objectStore.put(data);

            updateRequest.onerror = function(event) {
                console.error('Error updating record:', updateRequest.error?.name);
            };
        } else {
            console.error('Record not found');
        }
    };

    getRequest.onerror = function(event) {
        console.error('Error retrieving record:', getRequest.error?.name);
    };
}

export const getMetaData = (key: string): Promise<dbDataObject | null | undefined> => {
    return new Promise((resolve, reject) => {
        if (!db) return reject("db does not exist.");
        const transaction = db.transaction(['metadata'], 'readwrite');

        transaction.onerror = function(event) {
            reject(transaction.error)
            console.error('Transaction not opened due to error:', transaction.error);
        };

        const objectStore = transaction.objectStore('metadata');
        const request = objectStore.get(key)

        request.onsuccess = (evt) => {
            resolve(request.result as dbDataObject)
        }

        request.onerror = (evt) => {
            reject(request.error?.name)
        }
    })
}

export const deleteMetadata = (key: string) => {
    if (!db) return;
    const transaction = db.transaction(['metadata'], 'readwrite');

    transaction.onerror = function(event) {
        console.error('Transaction not opened due to error:', transaction.error);
    };

    const objectStore = transaction.objectStore('metadata');

    const deleted = objectStore.delete(key)

    deleted.onerror = (ev) => {
        console.error(deleted.error?.name)
    }

    deleted.onsuccess = (ev) => {
        console.log('delete successfully')
    }
}




