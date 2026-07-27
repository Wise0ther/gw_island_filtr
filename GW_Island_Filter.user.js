// ==UserScript==
// @name         GW_Island_Filter
// @namespace    http://tampermonkey.net/
// @version      2.2
// @updateURL    https://github.com/Wise0ther/gw_island_filtr/raw/refs/heads/main/GW_Island_Filter.user.js
// @downloadURL  https://github.com/Wise0ther/gw_island_filtr/raw/refs/heads/main/GW_Island_Filter.user.js
// @description  Фильтрация по островам (G, Z) с размещением кнопки в блоке пагинации и заголовках
// @author       Бурый_Медведь, программист чат-помощник Gemini
// @match        *://www.gwars.io/statlist.php?r=*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STORAGE_KEY = 'gw_island_filter_settings';

    // 1. Считываем/Записываем настройки
    function getSettings() {
        const defaultSettings = { showG: true, showZ: true };
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : defaultSettings;
        } catch (e) {
            return defaultSettings;
        }
    }

    function saveSettings(settings) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            console.error('[IslandFilter] Ошибка сохранения:', e);
        }
    }

    // 2. Универсальное определение острова у строки (PC + PDA)
    function getRowIsland(row) {
        const textContent = row.textContent || '';

        if (textContent.includes('[G]')) return 'G';
        if (textContent.includes('[Z]')) return 'Z';

        const mapLink = row.querySelector('a[href*="/map.php"]');
        if (mapLink) {
            const linkText = mapLink.textContent.trim();
            if (linkText.includes('G')) return 'G';
            if (linkText.includes('Z')) return 'Z';
        }

        return null;
    }

    // 3. Поиск всех таблиц с объектами
    function getResourceTables() {
        const allTables = document.querySelectorAll('table');
        const targetTables = [];

        allTables.forEach(table => {
            const hasObjectHeader = Array.from(table.querySelectorAll('td, th')).some(
                cell => cell.textContent.trim().includes('Объект')
            );

            if (hasObjectHeader) {
                targetTables.push(table);
            }
        });

        return targetTables;
    }

    // 4. Применение фильтра
    function applyFilters() {
        const settings = getSettings();
        const tables = getResourceTables();

        tables.forEach(table => {
            const rows = table.querySelectorAll('tr');

            rows.forEach(row => {
                if (row.textContent.includes('Объект')) return;

                const island = getRowIsland(row);
                if (!island) return;

                let shouldShow = true;
                if (island === 'G' && !settings.showG) shouldShow = false;
                if (island === 'Z' && !settings.showZ) shouldShow = false;

                row.style.display = shouldShow ? '' : 'none';
            });
        });
    }

    // 5. Окно настроек (Modal)
    function createModal() {
        if (document.getElementById('gw-filter-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'gw-filter-modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #e9ede0;
            border: 2px solid #336633;
            box-shadow: 0 0 20px rgba(0,0,0,0.6);
            padding: 15px;
            z-index: 999999;
            font-family: Verdana, Arial, sans-serif;
            font-size: 13px;
            color: #000;
            border-radius: 8px;
            width: 85%;
            max-width: 280px;
            box-sizing: border-box;
        `;

        const title = document.createElement('div');
        title.innerHTML = '<b>⚙️ Фильтр островов</b>';
        title.style.cssText = 'margin-bottom: 12px; border-bottom: 1px solid #336633; padding-bottom: 6px; font-size: 14px; text-align: center;';
        modal.appendChild(title);

        const settings = getSettings();

        // Чекбокс Остров G
        const labelG = document.createElement('label');
        labelG.style.cssText = 'display: flex; align-items: center; margin-bottom: 10px; cursor: pointer; font-size: 13px;';
        labelG.innerHTML = `<input type="checkbox" id="gw-chk-g" style="width: 18px; height: 18px; margin-right: 8px;" ${settings.showG ? 'checked' : ''}> Остров <b>[G]</b>`;
        modal.appendChild(labelG);

        // Чекбокс Остров Z
        const labelZ = document.createElement('label');
        labelZ.style.cssText = 'display: flex; align-items: center; margin-bottom: 15px; cursor: pointer; font-size: 13px;';
        labelZ.innerHTML = `<input type="checkbox" id="gw-chk-z" style="width: 18px; height: 18px; margin-right: 8px;" ${settings.showZ ? 'checked' : ''}> Остров <b>[Z]</b>`;
        modal.appendChild(labelZ);

        // Кнопки действия
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display: flex; justify-content: space-between; gap: 8px;';

        const saveBtn = document.createElement('button');
        saveBtn.innerText = 'Применить';
        saveBtn.style.cssText = 'flex: 1; padding: 8px; cursor: pointer; background: #336633; color: white; border: none; border-radius: 4px; font-weight: bold; font-size: 12px;';
        saveBtn.onclick = () => {
            const newSettings = {
                showG: document.getElementById('gw-chk-g').checked,
                showZ: document.getElementById('gw-chk-z').checked
            };
            saveSettings(newSettings);
            applyFilters();
            modal.style.display = 'none';
        };

        const closeBtn = document.createElement('button');
        closeBtn.innerText = 'Отмена';
        closeBtn.style.cssText = 'flex: 1; padding: 8px; cursor: pointer; background: #993333; color: white; border: none; border-radius: 4px; font-size: 12px;';
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };

        btnContainer.appendChild(saveBtn);
        btnContainer.appendChild(closeBtn);
        modal.appendChild(btnContainer);

        document.body.appendChild(modal);
    }

    function openModal() {
        let modal = document.getElementById('gw-filter-modal');
        if (!modal) {
            createModal();
            modal = document.getElementById('gw-filter-modal');
        }

        const settings = getSettings();
        document.getElementById('gw-chk-g').checked = settings.showG;
        document.getElementById('gw-chk-z').checked = settings.showZ;

        modal.style.display = 'block';
    }

    // Фабрика для быстрого создания элемента ссылки-кнопки
    function makeConfigButton(text) {
        const cfgBtn = document.createElement('a');
        cfgBtn.className = 'gw-filter-cfg-btn';
        cfgBtn.href = '#';
        cfgBtn.innerText = text;
        cfgBtn.title = 'Настройка фильтрации островов';
        cfgBtn.style.cssText = 'font-size: 12px; margin-right: 8px; text-decoration: none; color: #000099; font-weight: bold; display: inline-block;';

        cfgBtn.onclick = (e) => {
            e.preventDefault();
            openModal();
        };
        return cfgBtn;
    }

    // 6. Встраивание кнопки настройки (и в пагинацию td.greenwhitebg, и в заголовок «Объект»)
    function injectSettingButtons() {
        // Метод А: Встраиваем в блок пагинации (td.greenwhitebg)
        const paginationCells = document.querySelectorAll('td.greenwhitebg');
        paginationCells.forEach(cell => {
            if (cell.querySelector('.gw-filter-cfg-btn')) return;

            // Настраиваем выравнивание и позиционирование
            cell.style.textAlign = 'left';

            // Внутреннюю таблицу с номерами страниц сдвигаем правее или ставим рядом
            const innerTable = cell.querySelector('table');
            if (innerTable) {
                innerTable.style.display = 'inline-block';
                innerTable.style.verticalAlign = 'middle';
            }

            const btn = makeConfigButton('[⚙️ Настройки]');
            btn.style.verticalAlign = 'middle';
            btn.style.marginLeft = '6px';

            cell.insertBefore(btn, cell.firstChild);
        });

        // Метод Б: Запасной вариант — встраиваем в заголовок таблицы «Объект»
        const tables = getResourceTables();
        tables.forEach(table => {
            const allCells = table.querySelectorAll('td, th');

            let objectHeaderTd = null;
            allCells.forEach(cell => {
                if (cell.textContent.trim().includes('Объект') && !objectHeaderTd) {
                    objectHeaderTd = cell;
                }
            });

            if (!objectHeaderTd) return;
            if (objectHeaderTd.querySelector('.gw-filter-cfg-btn')) return;

            objectHeaderTd.setAttribute('align', 'left');
            objectHeaderTd.insertBefore(makeConfigButton('[⚙️]'), objectHeaderTd.firstChild);
        });
    }

    // 7. Обработка кликов по переключателям PDA
    function attachPdaTabListeners() {
        const sellTd = document.getElementById('selltd');
        const buyTd = document.getElementById('buytd');

        const reApplyWithDelay = () => {
            setTimeout(() => {
                injectSettingButtons();
                applyFilters();
            }, 100);
        };

        if (sellTd) sellTd.addEventListener('click', reApplyWithDelay);
        if (buyTd) buyTd.addEventListener('click', reApplyWithDelay);
    }

    // 8. Инициализация
    function init() {
        injectSettingButtons();
        createModal();
        applyFilters();
        attachPdaTabListeners();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
