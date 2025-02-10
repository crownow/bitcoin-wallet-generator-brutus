// server/workerTask.js
const workerpool = require("workerpool");
const { processPhrase } = require("./wallet");

// Экспортируем функцию для обработки фразы
workerpool.worker({
  processPhrase: function (phrase) {
    return processPhrase(phrase);
  },
});
