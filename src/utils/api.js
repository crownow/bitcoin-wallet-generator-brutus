// src/utils/api.js
async function uploadFile(file, socketId) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("socketId", socketId);

  const response = await fetch("http://localhost:3000/upload", {
    method: "POST",
    body: formData,
  });

  return response.json();
}

module.exports = { uploadFile };
