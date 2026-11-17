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

        const firstBoard = boards[0];
        card.appendChild(createGpuImage(
            firstBoard.images?.main,
            firstBoard.fullName
        ));

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
        const card = createElement("button", "board-card");
        card.type = "button";
        card.appendChild(createGpuImage(board.images?.main, board.fullName));

        const info = createElement("div", "board-info");
        info.appendChild(createElement("h4", "", board.edition));
        info.appendChild(createElement("p", "", `${board.fans ?? "—"} вентилятора`));
        info.appendChild(createElement("span", "", "ПОДРОБНЕЕ →"));
        card.appendChild(info);

        card.addEventListener("click", () => renderBoardDetails(model, board));
        grid.appendChild(card);
    });

    result.appendChild(grid);
}

// --------------------------------------------
// ПОДРОБНАЯ ИНФОРМАЦИЯ ОБ ИСПОЛНЕНИИ
// --------------------------------------------

function renderBoardDetails(model, board) {
    result.innerHTML = "";

    const backButton = createElement(
        "button",
        "catalog-back",
        "← НАЗАД К ИСПОЛНЕНИЯМ"
    );
    backButton.addEventListener("click", () => {
        const boards = (model.boards || []).filter(
            item => item.manufacturer === board.manufacturer
        );
        renderBoards(model, board.manufacturer, boards);
    });
    result.appendChild(backButton);

    result.appendChild(createElement(
        "span",
        "gpu-result-number",
        `GPU / ${board.manufacturer}`
    ));
    result.appendChild(createElement("h3", "catalog-subheading", board.fullName));

    const details = createElement("div", "board-details");
    details.appendChild(createGpuImage(board.images?.main, board.fullName));

    const info = createElement("div", "board-details-info");
    info.appendChild(createElement("h4", "", board.edition));
    info.appendChild(createElement("p", "", board.description || "Описание пока не добавлено."));
    info.appendChild(createElement("p", "", `Количество вентиляторов: ${board.fans ?? "—"}`));
    info.appendChild(createElement("p", "", `Память: ${model.memory || "—"}`));
    info.appendChild(createElement("p", "", `Архитектура: ${model.architecture || "—"}`));
    details.appendChild(info);
    result.appendChild(details);

    const galleryImages = board.images?.gallery || [];
    if (galleryImages.length > 0) {
        const gallery = createElement("div", "board-gallery");
        galleryImages.forEach(path => {
            gallery.appendChild(createGpuImage(path, board.fullName));
        });
        result.appendChild(gallery);
    }
}

// --------------------------------------------
// СТАРТ
// --------------------------------------------

loadDatabase();
