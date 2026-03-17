// ============================================================
// PDF Converter – Client-side  (pdf.js + pdf-lib + JSZip)
// ============================================================

// Set the pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ---- DOM references --------------------------------------------------------
const tabs      = document.querySelectorAll('.tab-btn');
const sections  = document.querySelectorAll('.tool-section');

// PDF → Images
const dropPdfToImg  = document.getElementById('dropzonePdfToImg');
const inputPdfToImg = document.getElementById('inputPdfToImg');
const infoPdfToImg  = document.getElementById('fileInfoPdfToImg');
const btnPdfToImg   = document.getElementById('btnConvertPdfToImg');
let   pdfToImgFile  = null;

// Images → PDF
const dropImgToPdf  = document.getElementById('dropzoneImgToPdf');
const inputImgToPdf = document.getElementById('inputImgToPdf');
const listImgToPdf  = document.getElementById('fileListImgToPdf');
const btnImgToPdf   = document.getElementById('btnConvertImgToPdf');
let   imgToPdfFiles = [];

// Merge PDF
const dropMerge  = document.getElementById('dropzoneMergePdf');
const inputMerge = document.getElementById('inputMergePdf');
const listMerge  = document.getElementById('fileListMergePdf');
const btnMerge   = document.getElementById('btnMergePdf');
let   mergeFiles = [];

// Split PDF
const dropSplit    = document.getElementById('dropzoneSplitPdf');
const inputSplit   = document.getElementById('inputSplitPdf');
const infoSplit    = document.getElementById('fileInfoSplitPdf');
const splitOptions = document.getElementById('splitOptions');
const splitPages   = document.getElementById('splitPages');
const btnSplit     = document.getElementById('btnSplitPdf');
let   splitFile    = null;

// PDF → Word
const dropPdfToWord  = document.getElementById('dropzonePdfToWord');
const inputPdfToWord = document.getElementById('inputPdfToWord');
const infoPdfToWord  = document.getElementById('fileInfoPdfToWord');
const btnPdfToWord   = document.getElementById('btnConvertPdfToWord');
let   pdfToWordFile  = null;

// Common
const progressContainer = document.getElementById('progressContainer');
const progressFill      = document.getElementById('progressFill');
const progressText      = document.getElementById('progressText');
const previewArea       = document.getElementById('previewArea');
const previewGrid       = document.getElementById('previewGrid');

// ---- Tab switching ---------------------------------------------------------
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        sections.forEach(s => s.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('section' + capitalize(tab.dataset.tool)).classList.add('active');
        hideProgress(); hidePreview();
    });
});

function capitalize(str) {
    return str.replace(/(^|-)(\w)/g, (_, _s, c) => c.toUpperCase()).replace(/-/g, '');
}

// ---- Helpers ---------------------------------------------------------------
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function showProgress(pct) {
    progressContainer.style.display = 'flex';
    progressFill.style.width = pct + '%';
    progressText.textContent = Math.round(pct) + '%';
}
function hideProgress() { progressContainer.style.display = 'none'; showProgress(0); }

function hidePreview() { previewArea.style.display = 'none'; previewGrid.innerHTML = ''; }

function renderFileList(container, files, onRemove) {
    container.innerHTML = '';
    files.forEach((f, i) => {
        const item = document.createElement('div');
        item.className = 'file-list-item';
        item.innerHTML = `<span class="name">${f.name}</span><span class="size">${formatSize(f.size)}</span><button class="remove-btn" data-idx="${i}">&times;</button>`;
        container.appendChild(item);
    });
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => onRemove(Number(btn.dataset.idx)));
    });
}

// Generic dropzone binder
function bindDropzone(dropzone, input, onFiles) {
    dropzone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => { if (input.files.length) onFiles(Array.from(input.files)); });
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', e => {
        e.preventDefault(); dropzone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) onFiles(Array.from(e.dataTransfer.files));
    });
}

// ---- 1. PDF → Images -------------------------------------------------------
bindDropzone(dropPdfToImg, inputPdfToImg, files => {
    pdfToImgFile = files[0];
    infoPdfToImg.textContent = `📄 ${pdfToImgFile.name}  (${formatSize(pdfToImgFile.size)})`;
    btnPdfToImg.disabled = false;
});

btnPdfToImg.addEventListener('click', async () => {
    if (!pdfToImgFile) return;
    btnPdfToImg.disabled = true;
    hidePreview();

    const arrayBuf = await pdfToImgFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
    const totalPages = pdf.numPages;
    const zip = new JSZip();
    const images = [];

    for (let i = 1; i <= totalPages; i++) {
        showProgress((i / totalPages) * 100);
        const page = await pdf.getPage(i);
        const scale = 2; // high-res
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        zip.file(`page_${i}.png`, blob);
        images.push(canvas.toDataURL('image/png'));
    }

    // Show preview
    previewArea.style.display = 'block';
    images.forEach((src, idx) => {
        const img = document.createElement('img');
        img.src = src; img.alt = `Page ${idx + 1}`; img.title = `Page ${idx + 1}`;
        previewGrid.appendChild(img);
    });

    // Download zip
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, pdfToImgFile.name.replace('.pdf', '') + '_images.zip');

    hideProgress();
    btnPdfToImg.disabled = false;
});

// ---- 2. Images → PDF -------------------------------------------------------
bindDropzone(dropImgToPdf, inputImgToPdf, files => {
    imgToPdfFiles = imgToPdfFiles.concat(files);
    renderImgList();
});

function renderImgList() {
    renderFileList(listImgToPdf, imgToPdfFiles, idx => {
        imgToPdfFiles.splice(idx, 1); renderImgList();
    });
    btnImgToPdf.disabled = imgToPdfFiles.length === 0;
}

btnImgToPdf.addEventListener('click', async () => {
    if (imgToPdfFiles.length === 0) return;
    btnImgToPdf.disabled = true;
    hidePreview();

    const pdfDoc = await PDFLib.PDFDocument.create();

    for (let i = 0; i < imgToPdfFiles.length; i++) {
        showProgress(((i + 1) / imgToPdfFiles.length) * 100);
        const bytes = await imgToPdfFiles[i].arrayBuffer();
        let image;
        const type = imgToPdfFiles[i].type;
        if (type === 'image/png') {
            image = await pdfDoc.embedPng(bytes);
        } else {
            image = await pdfDoc.embedJpg(bytes);
        }
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    saveAs(blob, 'images_combined.pdf');

    hideProgress();
    btnImgToPdf.disabled = false;
});

// ---- 3. Merge PDFs ---------------------------------------------------------
bindDropzone(dropMerge, inputMerge, files => {
    mergeFiles = mergeFiles.concat(files);
    renderMergeList();
});

function renderMergeList() {
    renderFileList(listMerge, mergeFiles, idx => {
        mergeFiles.splice(idx, 1); renderMergeList();
    });
    btnMerge.disabled = mergeFiles.length < 2;
}

btnMerge.addEventListener('click', async () => {
    if (mergeFiles.length < 2) return;
    btnMerge.disabled = true;
    hidePreview();

    const mergedPdf = await PDFLib.PDFDocument.create();

    for (let i = 0; i < mergeFiles.length; i++) {
        showProgress(((i + 1) / mergeFiles.length) * 100);
        const bytes = await mergeFiles[i].arrayBuffer();
        const donor = await PDFLib.PDFDocument.load(bytes);
        const pages = await mergedPdf.copyPages(donor, donor.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
    }

    const pdfBytes = await mergedPdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    saveAs(blob, 'merged.pdf');

    hideProgress();
    btnMerge.disabled = false;
});

// ---- 4. Split PDF ----------------------------------------------------------
bindDropzone(dropSplit, inputSplit, files => {
    splitFile = files[0];
    infoSplit.textContent = `📄 ${splitFile.name}  (${formatSize(splitFile.size)})`;
    splitOptions.style.display = 'flex';
    btnSplit.disabled = false;

    // Auto-detect page count
    splitFile.arrayBuffer().then(buf =>
        pdfjsLib.getDocument({ data: buf }).promise
    ).then(pdf => {
        infoSplit.textContent += `  •  ${pdf.numPages} หน้า`;
        splitPages.placeholder = `1-${pdf.numPages}`;
    });
});

btnSplit.addEventListener('click', async () => {
    if (!splitFile) return;
    const rangeStr = splitPages.value.trim();
    if (!rangeStr) { alert('กรุณาระบุหมายเลขหน้า'); return; }

    btnSplit.disabled = true;
    hidePreview();

    const bytes = await splitFile.arrayBuffer();
    const srcDoc = await PDFLib.PDFDocument.load(bytes);
    const totalPages = srcDoc.getPageCount();
    const indices = parsePageRange(rangeStr, totalPages);

    if (indices.length === 0) { alert('ช่วงหน้าไม่ถูกต้อง'); btnSplit.disabled = false; return; }

    const newDoc = await PDFLib.PDFDocument.create();
    const copied = await newDoc.copyPages(srcDoc, indices);
    copied.forEach(p => newDoc.addPage(p));

    showProgress(100);
    const pdfBytes = await newDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    saveAs(blob, splitFile.name.replace('.pdf', '') + '_extract.pdf');

    hideProgress();
    btnSplit.disabled = false;
});

function parsePageRange(str, max) {
    const result = new Set();
    str.split(',').forEach(part => {
        part = part.trim();
        if (part.includes('-')) {
            const [a, b] = part.split('-').map(Number);
            if (!isNaN(a) && !isNaN(b)) {
                for (let i = Math.max(1, a); i <= Math.min(max, b); i++) result.add(i - 1);
            }
        } else {
            const n = Number(part);
            if (!isNaN(n) && n >= 1 && n <= max) result.add(n - 1);
        }
    });
    return Array.from(result).sort((a, b) => a - b);
}

// ---- 5. PDF → Word ---------------------------------------------------------
bindDropzone(dropPdfToWord, inputPdfToWord, files => {
    pdfToWordFile = files[0];
    infoPdfToWord.textContent = `📄 ${pdfToWordFile.name}  (${formatSize(pdfToWordFile.size)})`;
    btnPdfToWord.disabled = false;
});

btnPdfToWord.addEventListener('click', async () => {
    if (!pdfToWordFile) return;
    btnPdfToWord.disabled = true;
    hidePreview();

    try {
        const arrayBuf = await pdfToWordFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
        const totalPages = pdf.numPages;

        const children = [];

        for (let i = 1; i <= totalPages; i++) {
            showProgress((i / totalPages) * 100);
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Group text items by approximate Y position to form lines
            const lines = [];
            let currentLine = [];
            let lastY = null;

            textContent.items.forEach(item => {
                const y = Math.round(item.transform[5]);
                if (lastY !== null && Math.abs(y - lastY) > 5) {
                    if (currentLine.length > 0) {
                        lines.push(currentLine.map(c => c.str).join(''));
                    }
                    currentLine = [];
                }
                currentLine.push(item);
                lastY = y;
            });
            if (currentLine.length > 0) {
                lines.push(currentLine.map(c => c.str).join(''));
            }

            // Add page heading
            children.push(
                new docx.Paragraph({
                    children: [
                        new docx.TextRun({
                            text: `--- หน้า ${i} ---`,
                            bold: true,
                            size: 28,
                            color: '4F46E5',
                        }),
                    ],
                    spacing: { after: 200 },
                })
            );

            // Add each line as a paragraph
            lines.forEach(line => {
                children.push(
                    new docx.Paragraph({
                        children: [
                            new docx.TextRun({
                                text: line || ' ',
                                size: 24,
                            }),
                        ],
                        spacing: { after: 60 },
                    })
                );
            });

            // Page break between pages (except the last)
            if (i < totalPages) {
                children.push(
                    new docx.Paragraph({
                        children: [],
                        pageBreakBefore: true,
                    })
                );
            }
        }

        const doc = new docx.Document({
            sections: [{
                properties: {},
                children: children,
            }],
        });

        const blob = await docx.Packer.toBlob(doc);
        saveAs(blob, pdfToWordFile.name.replace('.pdf', '') + '.docx');

        hideProgress();
        btnPdfToWord.disabled = false;

    } catch (err) {
        console.error('PDF to Word error:', err);
        alert('เกิดข้อผิดพลาดในการแปลงไฟล์: ' + err.message);
        hideProgress();
        btnPdfToWord.disabled = false;
    }
});

