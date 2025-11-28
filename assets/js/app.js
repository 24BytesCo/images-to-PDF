// Estado global de imágenes seleccionadas
const state = {
  images: [], // Cada elemento será { name, dataUrl }
  sort: 'asc'
};

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const previewGrid = document.getElementById('preview');
const actions = document.getElementById('actions');
const convertBtn = document.getElementById('convertBtn');
const loader = document.getElementById('loader');
const toolbar = document.getElementById('toolbar');
const sortSelect = document.getElementById('sortOrder');
const visitCounter = document.getElementById('visitCounter');
const pdfCounter = document.getElementById('pdfCounter');
const brandCounter = document.getElementById('brandCounter');
const brandBadge = document.querySelector('.brand-badge');

// Marca de agua fija
const WATERMARK_DATA_URL = 'imgs/24bytes-azul.png';
const WATERMARK_LINK = 'https://24bytes.pro/';
const WATERMARK_OPACITY = 0.1;
let watermarkPromise = null;

// Contador público vía CounterAPI (CountAPI dejó de resolver DNS)
const VISIT_COUNTER_URL = 'https://api.counterapi.dev/v1/imgtopdf.app/global/up';
const PDF_COUNTER_URL = 'https://api.counterapi.dev/v1/imgtopdf.app/pdf-created';
const BRAND_COUNTER_URL = 'https://api.counterapi.dev/v1/imgtopdf.app/brand-clicks';

const loadWatermark = () => {
  if (watermarkPromise) return watermarkPromise;
  watermarkPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const pngDataUrl = canvas.toDataURL('image/png');
      resolve({ dataUrl: pngDataUrl, width: img.width, height: img.height });
    };
    img.src = WATERMARK_DATA_URL;
  });
  return watermarkPromise;
};

// Utilidad: valida y obtiene lista de archivos de imagen
const getValidImages = (files) => {
  const acceptedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  return Array.from(files).filter(file => acceptedTypes.includes(file.type));
};

const sortImages = () => {
  if (state.sort === 'manual') return;
  const direction = state.sort === 'desc' ? -1 : 1;
  state.images.sort((a, b) => {
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    if (nameA < nameB) return -1 * direction;
    if (nameA > nameB) return 1 * direction;
    return 0;
  });
};

const resetSelection = () => {
  state.images = [];
  renderPreview();
  fileInput.value = '';
};

const showLoader = () => {
  loader.style.display = 'flex';
  convertBtn.disabled = true;
  convertBtn.textContent = 'Convirtiendo...';
};

const hideLoader = () => {
  loader.style.display = 'none';
  convertBtn.disabled = false;
  convertBtn.textContent = 'Convertir a PDF';
};

// Maneja la carga de archivos desde input o drop
const handleFiles = (files) => {
  const validImages = getValidImages(files);
  const rejected = files.length - validImages.length;
  if (!validImages.length) {
    if (rejected) alert('Solo se permiten imágenes JPG o PNG.');
    return;
  }
  if (rejected) alert('Algunos archivos fueron omitidos. Solo se permiten imágenes JPG o PNG.');

  validImages.forEach(file => {
    const reader = new FileReader();
    reader.onload = (event) => {
      state.images.push({ name: file.name, dataUrl: event.target.result });
      renderPreview();
    };
    reader.readAsDataURL(file);
  });
};

// Renderiza la cuadrícula de previsualización
const renderPreview = () => {
  previewGrid.innerHTML = '';

  sortImages();

  state.images.forEach((image, index) => {
    const card = document.createElement('article');
    card.className = 'thumb';
    card.draggable = true;
    card.dataset.index = index;
    const imgEl = document.createElement('img');
    imgEl.src = image.dataUrl;
    imgEl.alt = `Vista previa ${index + 1}`;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.setAttribute('aria-label', 'Eliminar imagen');
    removeBtn.textContent = '×';

    const nameBar = document.createElement('div');
    nameBar.className = 'thumb-name';
    nameBar.textContent = image.name || `Imagen ${index + 1}`;

    removeBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      state.images.splice(index, 1);
      renderPreview();
    });

    card.addEventListener('dragstart', (event) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', index);
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });

    card.addEventListener('dragover', (event) => {
      event.preventDefault();
      card.classList.add('drag-over');
      event.dataTransfer.dropEffect = 'move';
    });

    card.addEventListener('dragleave', (event) => {
      if (!card.contains(event.relatedTarget)) {
        card.classList.remove('drag-over');
      }
    });

    card.addEventListener('drop', (event) => {
      event.preventDefault();
      card.classList.remove('drag-over');
      const fromIndex = Number(event.dataTransfer.getData('text/plain'));
      const toIndex = Number(card.dataset.index);
      if (Number.isNaN(fromIndex) || Number.isNaN(toIndex) || fromIndex === toIndex) return;
      const [moved] = state.images.splice(fromIndex, 1);
      state.images.splice(toIndex, 0, moved);
      state.sort = 'manual';
      sortSelect.value = 'manual';
      renderPreview();
    });

    card.appendChild(imgEl);
    card.appendChild(nameBar);
    card.appendChild(removeBtn);
    previewGrid.appendChild(card);
  });

  // Mostrar u ocultar el botón de acción según haya imágenes
  const hasImages = state.images.length > 0;
  actions.style.display = hasImages ? 'flex' : 'none';
  toolbar.style.display = hasImages ? 'flex' : 'none';
};

// Eventos de la zona de carga
dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('dragover');
});

sortSelect.addEventListener('change', (event) => {
  state.sort = event.target.value;
  renderPreview();
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('dragover');
  handleFiles(event.dataTransfer.files);
});

fileInput.addEventListener('change', (event) => {
  handleFiles(event.target.files);
  // Reset para permitir cargar el mismo archivo de nuevo si se elimina
  event.target.value = '';
});

// Conversión a PDF usando jsPDF
const convertToPDF = async () => {
  if (!state.images.length) return;

  showLoader();
  try {
    // jsPDF viene como UMD; obtenemos el constructor desde window.jspdf
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const watermarkInfo = await loadWatermark().catch(() => null);

    for (let i = 0; i < state.images.length; i++) {
      const image = state.images[i];
      const format = image.dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      // Crear promesa para conocer dimensiones reales de la imagen
      const dimensions = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.src = image.dataUrl;
      });

      const ratio = dimensions.width / dimensions.height;
      const targetWidth = pageWidth;
      const targetHeight = targetWidth / ratio;

      // Si la altura sobrepasa la página, ajustamos por altura conservando proporción
      let drawWidth = targetWidth;
      let drawHeight = targetHeight;
      if (targetHeight > pageHeight) {
        drawHeight = pageHeight;
        drawWidth = drawHeight * ratio;
      }

      // Centrar verticalmente si queda espacio
      const x = (pageWidth - drawWidth) / 2;
      const y = (pageHeight - drawHeight) / 2;

      if (i > 0) pdf.addPage();
      pdf.addImage(image.dataUrl, format, x, y, drawWidth, drawHeight, undefined, 'FAST');

      // Marca de agua fija
      if (watermarkInfo) {
        const targetWidth = pageWidth * 0.125;
        const ratio = watermarkInfo.width / watermarkInfo.height;
        const targetHeight = targetWidth / ratio;
        const margin = 8;
        const wx = pageWidth - targetWidth - margin;
        const wy = pageHeight - targetHeight - margin;
        const gState = pdf.GState({ opacity: WATERMARK_OPACITY });
        pdf.setGState(gState);
        pdf.addImage(watermarkInfo.dataUrl, 'PNG', wx, wy, targetWidth, targetHeight, undefined, 'FAST');
        pdf.setGState(new pdf.GState({ opacity: 1 }));
        pdf.link(wx, wy, targetWidth, targetHeight, { url: WATERMARK_LINK, target: '_blank' });
      }
    }

    pdf.save('documento.pdf');
    await incrementPdfCounter();
    resetSelection();
  } catch (error) {
    console.error('Error al generar PDF:', error);
    alert('Ocurrió un error al generar el PDF. Intenta de nuevo.');
  } finally {
    hideLoader();
  }
};

convertBtn.addEventListener('click', convertToPDF);

const setCounterText = (element, label, value, options = {}) => {
  if (!element) return;
  const { onlyNumber = false } = options;
  const total = Number(value);
  const hasValue = Number.isFinite(total);
  element.textContent = onlyNumber
    ? (hasValue ? total.toLocaleString('es-ES') : 'N/D')
    : `${label}: ${hasValue ? total.toLocaleString('es-ES') : 'N/D'}`;
};

const fetchCounter = async (url, element, label, options = {}) => {
  if (!element) return;
  const { fallbackZeroOnMissing = false, onlyNumber = false } = options;
  try {
    const response = await fetch(url);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = (data?.message || '').toLowerCase();
      const isMissing = message.includes('record not found') || response.status === 404;
      if (fallbackZeroOnMissing && isMissing) {
        setCounterText(element, label, 0, { onlyNumber });
        return;
      }
      throw new Error(`Respuesta no válida (${response.status})`);
    }
    const total = Number(data?.value ?? data?.count);
    if (!Number.isFinite(total)) throw new Error('Valor no numérico');
    setCounterText(element, label, total, { onlyNumber });
  } catch (error) {
    setCounterText(element, label, NaN, { onlyNumber });
    console.error(`No se pudo actualizar el contador de ${label.toLowerCase()}`, error);
  }
};

// Contadores simples usando CounterAPI (sin cookies ni datos personales)
const updateVisitCounter = () => fetchCounter(VISIT_COUNTER_URL, visitCounter, 'Visitas');
const loadPdfCounter = () => fetchCounter(`${PDF_COUNTER_URL}/`, pdfCounter, 'PDFs creados', { fallbackZeroOnMissing: true });
const incrementPdfCounter = () => fetchCounter(`${PDF_COUNTER_URL}/up`, pdfCounter, 'PDFs creados');
const loadBrandCounter = () => fetchCounter(`${BRAND_COUNTER_URL}/`, brandCounter, 'Clicks 24Bytes', { fallbackZeroOnMissing: true, onlyNumber: true });
const incrementBrandCounter = () => fetchCounter(`${BRAND_COUNTER_URL}/up`, brandCounter, 'Clicks 24Bytes', { onlyNumber: true });

updateVisitCounter();
loadPdfCounter();
loadBrandCounter();

if (brandBadge) {
  brandBadge.addEventListener('click', () => {
    incrementBrandCounter();
  });
}
