# 🚀 Bitcoin Wallet Generator Brutus

**Bitcoin Wallet Generator Brutus** is a powerful tool for generating and checking Bitcoin addresses using keyword phrases.  
Built with **Electron.js**, this app allows users to upload phrase lists, process them efficiently, and check wallet balances.

---

## 📌 **Features**

- 🔹 Generate 4 types of Bitcoin addresses: `P2PKH`, `P2SH`, `P2WPKH`, `P2TR`
- 🔹 Support for **large files** and optimized batch processing
- 🔹 Automatic **memory management** to prevent memory leaks
- 🔹 API integration to **check wallet balances**
- 🔹 Process control: **Start / Stop / Continue**
- 🔹 **Full character set support**, including binary data
- 🔹 User-friendly **UI with results table**
- 🔹 **macOS ARM (M1/M2) support**

---

## ▶️ **Running the Application**

### **Standard Start**

```bash
npm start
```

## **Start with Increased Memory**

### If processing large files, use:

```bash
node --max-old-space-size=8192 --expose-gc node_modules/.bin/electron .
```

### How to Use

#### Uploading Keyword Phrases

**Click Select File – upload a text file containing keyword phrases.
Click Start – the app will begin processing the phrases in chunks.
Wait for Processing – results will appear in the table.
🔹 Process Controls
Stop – pauses the process.
Continue – resumes processing from where it left off.
🔹 Results Table**

```
Private Key	P2PKH	P2SH	P2WPKH	P2TR	Balance	Transactions
Private Key	Address	Address	Address	Address	Balance	Transactions
```

### If no wallets with balances are found, the message will appear:

#### **"No wallets with balance or transactions found"**

```
After processing, wallets with balances will be displayed:
export NODE_OPTIONS="--max-old-space-size=8192 --expose-gc"
source ~/.bashrc # или source ~/.zshrc
electron .
```
