async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("http://localhost:3000/upload", {
    method: "POST",
    body: formData,
  });

  return response.json();
}

module.exports = { uploadFile };
