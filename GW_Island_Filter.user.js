// ==UserScript==
// @name         GW_Island_Filter
// @namespace    http://tampermonkey.net/
// @version      3.1
// @updateURL    https://github.com/Wise0ther/gw_island_filtr/raw/refs/heads/main/GW_Island_Filter.user.js
// @downloadURL  https://github.com/Wise0ther/gw_island_filtr/raw/refs/heads/main/GW_Island_Filter.user.js
// @description  Фильтрация по островам (G, Z) с размещением кнопки в блоке пагинации и заголовках
// @author       Бурый_Медведь, программист чат-помощник
// @match        *://www.gwars.io/statlist.php?r=*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'gw_island_filter_settings';

    const DEFAULT_SETTINGS = {
        showG: true,
        showZ: true,
        showP: true,
        showStruck: true
    };

    const HIDDEN_CLASS = 'gw-island-filter-hidden';
    const GEAR_CLASS = 'gw-island-filter-gear';

    let settings = loadSettings();
    let modal = null;

    // =========================================================
    // Настройки
    // =========================================================

    function loadSettings() {
        try {
            const saved = JSON.parse(
                localStorage.getItem(STORAGE_KEY)
            );

            if (!saved || typeof saved !== 'object') {
                return { ...DEFAULT_SETTINGS };
            }

            return {
                showG:
                    typeof saved.showG === 'boolean'
                        ? saved.showG
                        : DEFAULT_SETTINGS.showG,

                showZ:
                    typeof saved.showZ === 'boolean'
                        ? saved.showZ
                        : DEFAULT_SETTINGS.showZ,

                showP:
                    typeof saved.showP === 'boolean'
                        ? saved.showP
                        : DEFAULT_SETTINGS.showP,

                showStruck:
                    typeof saved.showStruck === 'boolean'
                        ? saved.showStruck
                        : DEFAULT_SETTINGS.showStruck
            };
        } catch (error) {
            console.warn(
                'GW_Island_Filter: ошибка чтения настроек.',
                error
            );

            return { ...DEFAULT_SETTINGS };
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(settings)
            );
        } catch (error) {
            console.warn(
                'GW_Island_Filter: ошибка сохранения настроек.',
                error
            );
        }
    }

    // =========================================================
    // Стили
    // =========================================================

    function injectStyles() {
        if (document.getElementById('gw-island-filter-style')) {
            return;
        }

        const style = document.createElement('style');

        style.id = 'gw-island-filter-style';

        style.textContent = `
            .${HIDDEN_CLASS} {
                display: none !important;
            }

            .${GEAR_CLASS} {
                position: absolute;
                z-index: 2;
                margin: 0;
                padding: 0;
                border: 0;
                background: transparent;
                cursor: pointer;
                font-size: 18px;
                line-height: 20px;
                width: 22px;
                height: 22px;
                text-align: center;
                font-family: Arial, sans-serif;
            }

            .${GEAR_CLASS}:hover {
                opacity: 0.75;
            }

            #gw-island-filter-overlay {
                position: fixed;
                left: 0;
                top: 0;
                right: 0;
                bottom: 0;
                z-index: 99998;
                background: rgba(0, 0, 0, 0.25);
            }

            #gw-island-filter-modal {
                position: fixed;
                z-index: 99999;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
                min-width: 250px;
                padding: 12px 15px 14px;
                border: 1px solid #555;
                background: #f0f0f0;
                color: #000;
                box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
                font-family: Arial, sans-serif;
                font-size: 13px;
            }

            #gw-island-filter-modal-title {
                margin: 0 0 10px;
                font-weight: bold;
                text-align: center;
            }

            #gw-island-filter-modal label {
                display: block;
                margin: 7px 0;
                cursor: pointer;
                white-space: nowrap;
            }

            #gw-island-filter-modal input[type="checkbox"] {
                vertical-align: middle;
                margin: 0 6px 0 0;
            }

            #gw-island-filter-buttons {
                margin-top: 12px;
                text-align: center;
            }

            #gw-island-filter-buttons button {
                margin: 0 4px;
                padding: 2px 9px;
                cursor: pointer;
            }
        `;

        document.head.appendChild(style);
    }

    // =========================================================
    // Вспомогательные функции
    // =========================================================

    function cleanText(value) {
        return (value || '')
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /*
     * Проверяет, принадлежит ли элемент непосредственно
     * указанной таблице, а не вложенной в неё таблице.
     */
    function belongsToTable(element, table) {
        return element && element.closest('table') === table;
    }

    // =========================================================
    // Поиск таблиц объектов
    // =========================================================

    function findObjectHeader(table) {
        for (const row of Array.from(table.rows)) {
            /*
             * Защита от строк вложенных таблиц.
             */
            if (!belongsToTable(row, table)) {
                continue;
            }

            for (const cell of Array.from(row.cells)) {
                if (!belongsToTable(cell, table)) {
                    continue;
                }

                const boldElements =
                    cell.querySelectorAll('b');

                for (const bold of boldElements) {
                    /*
                     * Ключевое исправление:
                     * <b>Объект</b> должен принадлежать
                     * именно этой таблице.
                     */
                    if (!belongsToTable(bold, table)) {
                        continue;
                    }

                    if (
                        cleanText(bold.textContent) ===
                        'Объект'
                    ) {
                        return {
                            row,
                            cell,
                            title: bold
                        };
                    }
                }
            }
        }

        return null;
    }

    function findObjectTables() {
        const result = [];

        for (
            const table of Array.from(
                document.querySelectorAll('table')
            )
        ) {
            const header = findObjectHeader(table);

            if (!header) {
                continue;
            }

            const hasObject = Array.from(table.rows).some(
                row =>
                    belongsToTable(row, table) &&
                    getObjectRowInfo(row, table) !== null
            );

            if (!hasObject) {
                continue;
            }

            result.push({
                table,
                header
            });
        }

        return result;
    }

    // =========================================================
    // Распознавание строки объекта
    // =========================================================

    function getObjectRowInfo(row, table) {
        if (!row || !row.cells || !row.cells.length) {
            return null;
        }

        /*
         * Строка должна принадлежать именно анализируемой
         * таблице.
         */
        if (table && !belongsToTable(row, table)) {
            return null;
        }

        const firstCell = row.cells[0];

        if (table && !belongsToTable(firstCell, table)) {
            return null;
        }

        const mapLinks = Array.from(
            firstCell.querySelectorAll(
                'a[href*="map.php"]'
            )
        );

        const objectLinks = Array.from(
            firstCell.querySelectorAll(
                'a[href*="object.php?id="]'
            )
        );

        /*
         * Берём только ссылки, принадлежащие этой же таблице.
         */
        const mapLink = table
            ? mapLinks.find(
                link => belongsToTable(link, table)
            )
            : mapLinks[0];

        const objectLink = table
            ? objectLinks.find(
                link => belongsToTable(link, table)
            )
            : objectLinks[0];

        if (!mapLink || !objectLink) {
            return null;
        }

        const islandText = cleanText(
            mapLink.textContent
        );

        const islandMatch = islandText.match(
            /^\[([^\]]+)\]$/
        );

        /*
         * Ищем <s> только в пределах этой строки и этой
         * таблицы.
         */
        const struck = Array.from(
            firstCell.querySelectorAll('s')
        ).some(
            element =>
                !table ||
                belongsToTable(element, table)
        );

        return {
            island: islandMatch
                ? islandMatch[1].toUpperCase()
                : null,

            struck
        };
    }

    // =========================================================
    // Фильтрация
    // =========================================================

    function isIslandVisible(island) {
        switch (island) {
            case 'G':
                return settings.showG;

            case 'Z':
                return settings.showZ;

            case 'P':
                return settings.showP;

            default:
                /*
                 * Неизвестные острова не скрываем.
                 */
                return true;
        }
    }

    function shouldShowRow(info) {
        if (!isIslandVisible(info.island)) {
            return false;
        }

        if (info.struck && !settings.showStruck) {
            return false;
        }

        return true;
    }

    function applyFilters() {
        const objectTables = findObjectTables();

        for (const { table } of objectTables) {
            for (const row of Array.from(table.rows)) {
                /*
                 * Не трогаем строки вложенных таблиц.
                 */
                if (!belongsToTable(row, table)) {
                    continue;
                }

                const info =
                    getObjectRowInfo(row, table);

                /*
                 * Заголовки, пагинация и другие служебные
                 * строки никогда не скрываются.
                 */
                if (!info) {
                    row.classList.remove(HIDDEN_CLASS);
                    continue;
                }

                row.classList.toggle(
                    HIDDEN_CLASS,
                    !shouldShowRow(info)
                );
            }
        }
    }

    // =========================================================
    // Окно настроек
    // =========================================================

    function createCheckbox(
        container,
        id,
        text,
        checked
    ) {
        const label = document.createElement('label');

        const checkbox =
            document.createElement('input');

        checkbox.type = 'checkbox';
        checkbox.id = id;
        checkbox.checked = checked;

        label.appendChild(checkbox);
        label.appendChild(
            document.createTextNode(text)
        );

        container.appendChild(label);

        return checkbox;
    }

    function closeSettings() {
        if (!modal) {
            return;
        }

        modal.overlay.remove();
        modal.window.remove();

        modal = null;
    }

    function openSettings() {
        if (modal) {
            return;
        }

        const overlay =
            document.createElement('div');

        overlay.id =
            'gw-island-filter-overlay';

        const windowElement =
            document.createElement('div');

        windowElement.id =
            'gw-island-filter-modal';

        const title =
            document.createElement('div');

        title.id =
            'gw-island-filter-modal-title';

        title.textContent =
            'Фильтр островов';

        windowElement.appendChild(title);

        const checkboxG = createCheckbox(
            windowElement,
            'gw-filter-g',
            'Остров [G]',
            settings.showG
        );

        const checkboxZ = createCheckbox(
            windowElement,
            'gw-filter-z',
            'Остров [Z]',
            settings.showZ
        );

        const checkboxP = createCheckbox(
            windowElement,
            'gw-filter-p',
            'Остров [P]',
            settings.showP
        );

        const checkboxStruck = createCheckbox(
            windowElement,
            'gw-filter-struck',
            'Зачеркнутые объекты',
            settings.showStruck
        );

        const buttons =
            document.createElement('div');

        buttons.id =
            'gw-island-filter-buttons';

        const applyButton =
            document.createElement('button');

        applyButton.type = 'button';
        applyButton.textContent = 'Применить';

        const cancelButton =
            document.createElement('button');

        cancelButton.type = 'button';
        cancelButton.textContent = 'Отмена';

        buttons.appendChild(applyButton);
        buttons.appendChild(cancelButton);

        windowElement.appendChild(buttons);

        document.body.appendChild(overlay);
        document.body.appendChild(windowElement);

        modal = {
            overlay,
            window: windowElement
        };

        applyButton.addEventListener(
            'click',
            function () {
                settings = {
                    showG: checkboxG.checked,
                    showZ: checkboxZ.checked,
                    showP: checkboxP.checked,
                    showStruck:
                        checkboxStruck.checked
                };

                saveSettings();
                applyFilters();
                closeSettings();
            }
        );

        cancelButton.addEventListener(
            'click',
            closeSettings
        );

        overlay.addEventListener(
            'click',
            closeSettings
        );

        windowElement.addEventListener(
            'click',
            event => event.stopPropagation()
        );

        document.addEventListener(
            'keydown',
            function escapeHandler(event) {
                if (event.key !== 'Escape') {
                    return;
                }

                closeSettings();
            },
            { once: true }
        );
    }

    // =========================================================
    // Шестерёнка около "Объект"
    // =========================================================

    function positionGear(headerCell, title, gear) {
        const cellRect =
            headerCell.getBoundingClientRect();

        const titleRect =
            title.getBoundingClientRect();

        const gearWidth =
            gear.offsetWidth || 22;

        const gap = 3;

        let left =
            titleRect.left -
            cellRect.left -
            gearWidth -
            gap;

        if (left < 1) {
            left = 1;
        }

        gear.style.left = `${left}px`;

        const top =
            titleRect.top -
            cellRect.top +
            (
                titleRect.height -
                gear.offsetHeight
            ) / 2;

        gear.style.top =
            `${Math.max(0, top)}px`;
    }

    function addGear(header) {
        const { cell, title } = header;

        if (
            cell.querySelector(
                `.${GEAR_CLASS}`
            )
        ) {
            return;
        }

        const computed =
            getComputedStyle(cell);

        if (computed.position === 'static') {
            cell.style.position = 'relative';
        }

        const gear =
            document.createElement('button');

        gear.type = 'button';
        gear.className = GEAR_CLASS;

        /*
         * Более выразительная emoji-шестерёнка.
         */
        gear.textContent = '⚙️';

        gear.title = 'Настройки фильтра';

        gear.setAttribute(
            'aria-label',
            'Настройки фильтра'
        );

        gear.addEventListener(
            'click',
            function (event) {
                event.preventDefault();
                event.stopPropagation();

                openSettings();
            }
        );

        cell.appendChild(gear);

        positionGear(
            cell,
            title,
            gear
        );
    }

    function installGears() {
        const objectTables = findObjectTables();

        for (const { header } of objectTables) {
            addGear(header);
        }
    }

    // =========================================================
    // Запуск
    // =========================================================

    function init() {
        injectStyles();
        installGears();
        applyFilters();
    }

    if (document.readyState === 'loading') {
        document.addEventListener(
            'DOMContentLoaded',
            init,
            { once: true }
        );
    } else {
        init();
    }

})();
