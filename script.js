/* ============================================
   GPU INSIDER — ДИНАМИЧЕСКИЙ КАТАЛОГ
   Совместим с текущим data/gpus.json.
   Старый массив families считается веткой NVIDIA.
   В будущем поддерживается формат vendors[].families.
============================================ */

const hardwareSection = document.querySelector(".hardware");
const vendorButtons = document.querySelectorAll(".vendor-button");
const catalog = document.getElementById("gpu-catalog");

const familyStep = document.getElementById("family-step");
const generationStep = document.getElementById("generation-step");
const modelStep = document.getElementById("model-step");

const familySelect = document.getElementById("gpu-family");
const generationSelect = document.getElementById("gpu-generation");
const modelSelect = document.getElementById("gpu-model");
const result = document.getElementById("gpu-result");

let gpuDatabase = null;
let selectedVendor = null;
let currentFamilies = [];

// --------------------------------------------
// ЗАГРУЗКА БАЗЫ
// --------------------------------------------

async function loadDatabase() {
    try {
        const response = await fetch("data/gpus.json");

        if (!response.ok) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }

        gpuDatabase = await response.json();
        console.log("GPU INSIDER: база видеокарт загружена.");
    } catch (error) {
        console.error("Ошибка загрузки каталога:", error);
        result.innerHTML = `
            <div class="gpu-result-number">GPU / ERROR</div>
            <h3>НЕ УДАЛОСЬ ЗАГРУЗИТЬ БАЗУ</h3>
            <p>Проверь файл data/gpus.json и запусти сайт через Live Server.</p>
        `;
    }
}

// --------------------------------------------
// ПОЛУЧЕНИЕ ДАННЫХ ВЫБРАННОГО ПРОИЗВОДИТЕЛЯ
// --------------------------------------------

function getFamiliesForVendor(vendorId) {
    // Новый формат на будущее: { vendors: [{ id, families: [...] }] }
    if (Array.isArray(gpuDatabase?.vendors)) {
        const vendor = gpuDatabase.vendors.find(item => item.id === vendorId);
        return vendor?.families || [];
    }

    // Совместимость с нынешним JSON: корневой families — NVIDIA.
    if (vendorId === "nvidia" && Array.isArray(gpuDatabase?.families)) {
        return gpuDatabase.families;
    }

    // В текущей базе AMD пока не заполнена.
    return [];
}

function findFamily(id) {
    return currentFamilies.find(item => item.id === id);
}

function findGeneration(familyId, generationId) {
    const family = findFamily(familyId);
    return family?.generations?.find(item => item.id === generationId);
}

function findModel(familyId, generationId, modelId) {
    const generation = findGeneration(familyId, generationId);
    return generation?.models?.find(item => item.id === modelId);
}

// --------------------------------------------
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// --------------------------------------------

function createElement(tag, className, text = "") {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
}

function fillSelect(select, items, placeholder) {
    select.innerHTML = "";

    const firstOption = document.createElement("option");
    firstOption.value = "";
    firstOption.textContent = placeholder;
    select.appendChild(firstOption);

    items.forEach(item => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = item.name;
        select.appendChild(option);
    });

    select.disabled = items.length === 0;
}

function revealStep(step) {
    // Класс добавляется на следующем кадре, чтобы CSS успел запустить transition.
    requestAnimationFrame(() => step.classList.add("is-visible"));
}

function hideStep(step) {
    step.classList.remove("is-visible");
}

function resetResult() {
    result.innerHTML = "";
    result.classList.remove("active");

    const number = createElement("div", "gpu-result-number", "GPU / 000");
    const title = createElement("h3", "", "ТВОЯ ВИДЕОКАРТА ЖДЁТ ВЫБОРА");
    const description = createElement(
        "p",
        "",
        "Выбери производителя, семейство, поколение и модель видеокарты."
    );

    result.append(number, title, description);
}

function showVendorEmptyState(vendorId) {
    result.innerHTML = "";
    result.classList.add("active");

    const number = createElement(
        "div",
        "gpu-result-number",
        vendorId === "amd" ? "AMD / DATABASE" : "NVIDIA / DATABASE"
    );
    const title = createElement("h3", "", "РАЗДЕЛ ПОКА НАПОЛНЯЕТСЯ");
    const description = createElement(
        "p",
        "",
        vendorId === "amd"
            ? "Ветка AMD будет добавлена в базу. Сейчас продолжаем наполнять каталог NVIDIA."
            : "В этой ветке пока нет добавленных семейств видеокарт."
    );

    result.append(number, title, description);
}

// --------------------------------------------
// ВЫБОР NVIDIA / AMD
// --------------------------------------------

vendorButtons.forEach(button => {
    button.addEventListener("click", () => {
        if (!gpuDatabase) {
            result.innerHTML = `
                <div class="gpu-result-number">GPU / DATABASE</div>
                <h3>БАЗА ЕЩЁ ЗАГРУЖАЕТСЯ</h3>
                <p>Подожди немного и попробуй ещё раз.</p>
            `;
            return;
        }

        const vendorId = button.dataset.vendor;
        selectVendor(vendorId);
    });
});

function selectVendor(vendorId) {
    selectedVendor = vendorId;
    currentFamilies = getFamiliesForVendor(vendorId);

    hardwareSection.dataset.vendor = vendorId;

    vendorButtons.forEach(button => {
        const isSelected = button.dataset.vendor === vendorId;
        button.classList.toggle("is-selected", isSelected);
        button.setAttribute("aria-pressed", String(isSelected));
    });

    // Сбрасываем следующие уровни при смене NVIDIA / AMD.
    hideStep(generationStep);
    hideStep(modelStep);

    fillSelect(
        familySelect,
        currentFamilies,
        currentFamilies.length
            ? "Выбери семейство"
            : "Раздел пока наполняется"
    );

    fillSelect(generationSelect, [], "Сначала выбери семейство");
    fillSelect(modelSelect, [], "Сначала выбери поколение");

    catalog.classList.add("is-open");
    revealStep(familyStep);

    if (currentFamilies.length === 0) {
        showVendorEmptyState(vendorId);
    } else {
        resetResult();
    }
}

// --------------------------------------------
// 01. ВЫБОР СЕМЕЙСТВА
// --------------------------------------------

familySelect.addEventListener("change", () => {
    const family = findFamily(familySelect.value);

    hideStep(modelStep);
    fillSelect(generationSelect, [], "Сначала выбери семейство");
    fillSelect(modelSelect, [], "Сначала выбери поколение");
    resetResult();

    if (!family) {
        hideStep(generationStep);
        return;
    }

    const generations = (family.generations || []).map(item => ({
        id: item.id,
        name: item.name
    }));

    fillSelect(generationSelect, generations, "Выбери поколение");

    if (generations.length > 0) {
        revealStep(generationStep);
    }
});

// --------------------------------------------
// 02. ВЫБОР ПОКОЛЕНИЯ
// --------------------------------------------

generationSelect.addEventListener("change", () => {
    const generation = findGeneration(
        familySelect.value,
        generationSelect.value
    );

    fillSelect(modelSelect, [], "Сначала выбери поколение");
    resetResult();

    if (!generation) {
        hideStep(modelStep);
        return;
    }

    const models = (generation.models || []).map(item => ({
        id: item.id,
        name: item.name
    }));

    fillSelect(modelSelect, models, "Выбери модель");

    if (models.length > 0) {
        revealStep(modelStep);
    }
});

// --------------------------------------------
// 03. ВЫБОР МОДЕЛИ
// --------------------------------------------

modelSelect.addEventListener("change", () => {
    const model = findModel(
        familySelect.value,
        generationSelect.value,
        modelSelect.value
    );

    if (!model) {
        resetResult();
        return;
    }

    renderManufacturers(model);
});

// --------------------------------------------
// СОЗДАНИЕ ИЗОБРАЖЕНИЯ
// --------------------------------------------

function createGpuImage(path, alt) {
    const wrapper = createElement("div", "gpu-image-wrapper");
    const placeholder = createElement(
        "div",
        "gpu-image-placeholder",
        "GPU INSIDER"
    );
    const image = document.createElement("img");

    image.alt = alt;
    image.loading = "lazy";

    image.onerror = () => {
        image.style.display = "none";
        placeholder.style.display = "flex";
    };

    if (path) {
        image.src = path;
        placeholder.style.display = "none";
    } else {
        image.style.display = "none";
    }

    wrapper.append(image, placeholder);
    return wrapper;
}

// --------------------------------------------
// ЛОГОТИПЫ ПРОИЗВОДИТЕЛЕЙ
// --------------------------------------------

function getManufacturerLogoPath(name) {
    const logos = {
        "MSI": "msi.png",
        "ASUS": "asus.png",
        "Gigabyte": "gigabyte.png",
        "GIGABYTE": "gigabyte.png",
        "Palit": "palit.png",
        "Gainward": "gainward.png"
    };

    return `assets/images/manufacturers/${logos[name] || ""}`;
}

function createManufacturerLogo(name) {
    const wrapper = createElement("div", "manufacturer-logo-wrapper");
    const fallback = createElement("span", "manufacturer-logo-fallback", name);
    const image = document.createElement("img");

    image.alt = `${name} — логотип производителя`;
    image.loading = "lazy";
    image.src = getManufacturerLogoPath(name);

    image.onload = () => {
        image.style.display = "block";
        fallback.style.display = "none";
    };

    image.onerror = () => {
        image.style.display = "none";
        fallback.style.display = "block";
    };

    wrapper.append(image, fallback);
    return wrapper;
}

// --------------------------------------------
// КАРТОЧКИ ПРОИЗВОДИТЕЛЕЙ
// --------------------------------------------

function renderManufacturers(model) {
    result.innerHTML = "";
    result.classList.add("active");

    const heading = createElement("div", "catalog-result-heading");
    heading.appendChild(createElement(
        "span",
        "gpu-result-number",
        "GPU / MANUFACTURERS"
    ));
    heading.appendChild(createElement("h3", "", model.name));
    heading.appendChild(createElement(
        "p",
        "",
        "Выбери производителя видеокарты."
    ));
    result.appendChild(heading);

    const grid = createElement("div", "manufacturer-grid");
    const manufacturers = {};

    (model.boards || []).forEach(board => {
        if (!manufacturers[board.manufacturer]) {
            manufacturers[board.manufacturer] = [];
        }
        manufacturers[board.manufacturer].push(board);
    });

    Object.entries(manufacturers).forEach(([name, boards]) => {
        const card = createElement("button", "manufacturer-card");
        card.type = "button";

        // На уровне производителя показываем логотип бренда,
        // а фотографии видеокарт оставляем для следующего уровня.
        card.appendChild(createManufacturerLogo(name));

        const info = createElement("div", "manufacturer-info");
        info.appendChild(createElement("h4", "", name));
        info.appendChild(createElement("p", "", `${boards.length} исполнений`));
        info.appendChild(createElement("span", "", "СМОТРЕТЬ МОДЕЛИ →"));
        card.appendChild(info);

        card.addEventListener("click", () => {
            renderBoards(model, name, boards);
        });

        grid.appendChild(card);
    });

    if (Object.keys(manufacturers).length === 0) {
        result.appendChild(createElement(
            "p",
            "",
            "Для этой модели пока не добавлены исполнения производителей."
        ));
    } else {
        result.appendChild(grid);
    }
}

// --------------------------------------------
// КАРТОЧКИ ИСПОЛНЕНИЙ
// --------------------------------------------

function renderBoards(model, manufacturer, boards) {
    result.innerHTML = "";

    const backButton = createElement(
        "button",
        "catalog-back",
        "← НАЗАД К ПРОИЗВОДИТЕЛЯМ"
    );
    backButton.addEventListener("click", () => renderManufacturers(model));
    result.appendChild(backButton);

    result.appendChild(createElement(
        "span",
        "gpu-result-number",
        `${model.name} / ${manufacturer}`
    ));
    result.appendChild(createElement(
        "h3",
        "catalog-subheading",
        `Исполнения ${manufacturer}`
    ));

    const grid = createElement("div", "board-grid");

    boards.forEach(board => {
        const card = createElement("article", "board-card");
        card.appendChild(createGpuImage(board.images?.main, board.fullName));

        const info = createElement("div", "board-info");
        info.appendChild(createElement("h4", "", board.edition));
        const summary = createElement("div", "board-card-specs");
        [
            ["Память", model.memory || "—"],
            ["Вентиляторы", board.fans != null ? `${board.fans} шт.` : "—"],
            ["Boost", board.boostClock || "Уточняется"],
            ["Шина памяти", model.memoryBus || "—"],
            ["Интерфейс", board.interface || "—"]
        ].forEach(([label, value]) => {
            const line = createElement("div", "board-card-spec");
            line.append(createElement("span", "", label), createElement("strong", "", value));
            summary.appendChild(line);
        });
        info.appendChild(summary);
        const moreButton = createElement("button", `board-card-more board-more-${selectedVendor || "nvidia"}`, "ПОДРОБНЕЕ");
        moreButton.type = "button";
        moreButton.addEventListener("click", () => renderBoardDetails(model, board));
        info.appendChild(moreButton);
        card.appendChild(info);
        grid.appendChild(card);
    });

    result.appendChild(grid);
}

// --------------------------------------------
// ПОДРОБНАЯ ИНФОРМАЦИЯ ОБ ИСПОЛНЕНИИ
// --------------------------------------------

function renderBoardDetails(model, board) {
    result.innerHTML = "";
    const backButton = createElement("button", `catalog-back detail-accent-${selectedVendor || "nvidia"}`, "← НАЗАД К ИСПОЛНЕНИЯМ");
    backButton.addEventListener("click", () => {
        renderBoards(model, board.manufacturer,
            (model.boards || []).filter(item => item.manufacturer === board.manufacturer));
    });
    result.appendChild(backButton);
    result.appendChild(createElement("span", "gpu-result-number", `${model.name} / ${board.manufacturer}`));
    result.appendChild(createElement("h3", "catalog-subheading", board.fullName));

    const hero = createElement("div", `detail-hero detail-theme-${selectedVendor || "nvidia"}`);
    hero.appendChild(createGpuImage(board.images?.main, board.fullName));
    const intro = createElement("div", "detail-intro");
    intro.appendChild(createElement("p", "", board.description || model.description || "Описание пока не добавлено."));
    const highlights = createElement("ul", "detail-highlights");
    (board.boardHighlights || model.gpuHighlights || []).forEach(x => highlights.appendChild(createElement("li", "", x)));
    intro.appendChild(highlights);
    hero.appendChild(intro);
    result.appendChild(hero);

    const quick = createElement("div", "detail-quick-specs");
    [
      ["Видеопамять", model.memory || "—"],
      ["Вентиляторы", board.fans != null ? `${board.fans} шт.` : "—"],
      ["Boost", board.boostClock || "Уточняется"],
      ["Шина памяти", model.memoryBus || "—"],
      ["Видеовыходы", board.outputs || "Уточняются"],
      ["Интерфейс", board.interface || "—"]
    ].forEach(([label,value]) => {
      const item=createElement("div","detail-quick-item");
      item.append(createElement("span","",label),createElement("strong","",value));
      quick.appendChild(item);
    });
    result.appendChild(quick);

    const galleryImages=board.images?.gallery || [];
    if(galleryImages.length){
      const section=createElement("section","detail-section");
      section.appendChild(createElement("h4","","ФОТОГАЛЕРЕЯ"));
      const gallery=createElement("div","board-gallery");
      galleryImages.forEach((path,index)=>{
        const image=createGpuImage(path,board.images?.galleryLabels?.[index] || board.fullName);
        image.classList.add("gallery-clickable");
        image.addEventListener("click",()=>openImageViewer(galleryImages,index,board));
        gallery.appendChild(image);
      });
      section.appendChild(gallery); result.appendChild(section);
    }

    const gpuRows=[
      ["Графический процессор",model.chip || "—"],["Архитектура",model.architecture || "—"],
      ["Техпроцесс",model.process || "—"],["CUDA-ядер",model.cudaCores ?? "—"],
      ["Видеопамять",model.memory || "—"],["Шина памяти",model.memoryBus || "—"],
      ["Пропускная способность",model.memoryBandwidth || "—"],["Дата выхода",model.releaseDate || "—"],
      ["API",model.api || "—"]
    ];
    const boardRows=[
      ["Boost-частота",board.boostClock || "Уточняется"],["Частота памяти",board.memoryClock || "Уточняется"],
      ["Интерфейс",board.interface || "Уточняется"],["Видеовыходы",board.outputs || "Уточняется"],
      ["Энергопотребление",board.power || "Уточняется"],["Разъём питания",board.powerConnector || "Уточняется"],
      ["Рекомендуемый БП",board.recommendedPsu || "Уточняется"],["Габариты",board.dimensions || "Уточняется"],
      ["Толщина",board.slots || "Уточняется"],["Система охлаждения",board.cooling || "Уточняется"]
    ];
    result.appendChild(createSpecsSection("ХАРАКТЕРИСТИКИ ГРАФИЧЕСКОГО ПРОЦЕССОРА",gpuRows));
    result.appendChild(createSpecsSection("ХАРАКТЕРИСТИКИ ИСПОЛНЕНИЯ",boardRows));
    if(board.coolingFeatures?.length){
      const section=createElement("section","detail-section");
      section.appendChild(createElement("h4","","ОСОБЕННОСТИ ОХЛАЖДЕНИЯ"));
      const list=createElement("ul","detail-feature-list");
      board.coolingFeatures.forEach(x=>list.appendChild(createElement("li","",x)));
      section.appendChild(list); result.appendChild(section);
    }
    // Развёрнутое описание самой модели GPU — общие сведения не дублируют данные платы.
    const overview = createElement("section", "detail-section");
    overview.appendChild(createElement("h4", "", "О ВИДЕОКАРТЕ"));
    overview.appendChild(createElement("p", "detail-overview-text", model.gpuDescription || model.description || "Описание будет добавлено."));
    result.appendChild(overview);

    const extraRows = [
      ["Базовая частота GPU (референс)", model.baseClock || "Нет подтверждённых данных"],
      ["Boost-частота GPU (референс)", model.referenceBoostClock || "Нет подтверждённых данных"],
      ["Скорость памяти", model.memorySpeed || "Нет подтверждённых данных"],
      ["Дата выхода", model.releaseDate || "Нет подтверждённых данных"]
    ];
    result.appendChild(createSpecsSection("ДОПОЛНИТЕЛЬНЫЕ СВЕДЕНИЯ О GPU", extraRows));

    if (Array.isArray(model.sources) && model.sources.length) {
      result.appendChild(createSourcesSection("ИСТОЧНИКИ ПО ГРАФИЧЕСКОМУ ПРОЦЕССОРУ", model.sources));
    }
    if (Array.isArray(board.sourceLinks) && board.sourceLinks.length) {
      result.appendChild(createSourcesSection("ИСТОЧНИКИ ПО ИСПОЛНЕНИЮ", board.sourceLinks));
    }
    result.appendChild(createElement("p", "detail-source-note",
      `Проверено по: ${board.source || "источники не указаны"}. Характеристики, которые не удалось подтвердить для конкретного исполнения, помечены «Уточняется».`));
}

function createSpecsSection(title, rows) {
    const section=createElement("section","detail-section");
    section.appendChild(createElement("h4","",title));
    const table=createElement("div","detail-spec-table");
    rows.forEach(([label,value])=>{
      const row=createElement("div","detail-spec-row");
      row.append(createElement("span","",label),createElement("strong","",String(value)));
      table.appendChild(row);
    });
    section.appendChild(table); return section;
}

function createSourcesSection(title, sources) {
    const section = createElement("section", "detail-section");
    section.appendChild(createElement("h4", "", title));
    const list = createElement("ul", "detail-sources-list");
    sources.forEach(source => {
        const item = document.createElement("li");
        const link = createElement("a", "", source.label || source.url);
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        item.appendChild(link);
        list.appendChild(item);
    });
    section.appendChild(list);
    return section;
}

function openImageViewer(images,startIndex,board) {
    let index=startIndex;
    const overlay=createElement("div","image-viewer");
    overlay.setAttribute("role","dialog");
    overlay.setAttribute("aria-modal","true");
    const image=document.createElement("img"); image.alt=board.fullName;
    const close=createElement("button","image-viewer-close","×");
    const prev=createElement("button","image-viewer-arrow image-viewer-prev","‹");
    const next=createElement("button","image-viewer-arrow image-viewer-next","›");
    const counter=createElement("span","image-viewer-counter");
    const update=()=>{image.src=images[index];counter.textContent=`${index+1} / ${images.length}`;};
    const cleanup=()=>{overlay.remove();document.removeEventListener("keydown",keys);};
    const keys=e=>{
      if(e.key==="Escape")cleanup();
      if(e.key==="ArrowLeft"){index=(index-1+images.length)%images.length;update();}
      if(e.key==="ArrowRight"){index=(index+1)%images.length;update();}
    };
    close.addEventListener("click",cleanup);
    prev.addEventListener("click",()=>{index=(index-1+images.length)%images.length;update();});
    next.addEventListener("click",()=>{index=(index+1)%images.length;update();});
    overlay.addEventListener("click",e=>{if(e.target===overlay)cleanup();});
    overlay.append(prev,image,next,close,counter);document.body.appendChild(overlay);
    document.addEventListener("keydown",keys);update();
}

// СТАРТ
// --------------------------------------------

loadDatabase();
