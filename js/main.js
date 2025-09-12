import { stateManager } from './state.js';
import * as cache from './cache.js';
import { renderApp, setupNavigation, showFilterActionModal, hideFilterActionModal, getCurrentModalNumbers, getCurrentModalGroupName, EXPLORER_CRITERIA, switchTab } from './ui.js';

function handleCreateFilterFromModal(type) {
    const numbers = getCurrentModalNumbers();
    if (numbers.length === 0) return;

    const groupName = getCurrentModalGroupName() || 'Sélection';
    const { currentCriteria } = stateManager.getState().ui.stats;
    
    stateManager.getState().filters.forEach(f => f.isCollapsed = true);

    let newFilter;
    if (type === 'VECT') {
        newFilter = { name: 'VECT', active: true, vect: numbers.join(' '), min: '1', max: '1', isCollapsed: false, label: groupName };
    } else if (type === 'ORDER') {
        newFilter = { name: 'ORDER', active: true, percentage: '50', column: currentCriteria, vect: numbers.join(' '), isCollapsed: false, label: groupName };
    } else if (type === 'SOM') {
        newFilter = { name: 'SOM', active: true, column: currentCriteria, min: '', max: '', isCollapsed: false, label: groupName };
    } else if (type === 'GAP') {
        newFilter = { name: 'GAP', active: true, column: currentCriteria, min: '', max: '', isCollapsed: false, label: groupName };
    }
    
    stateManager.addFilter(newFilter);
    switchTab('filters');
    hideFilterActionModal();
}

function setupTheme() {
    const themeToggleCheckbox = document.getElementById('theme-toggle-checkbox');
    if (!themeToggleCheckbox) return; // Sécurité : si l'élément n'existe pas, on arrête.
    
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.body.dataset.theme = 'dark';
            themeToggleCheckbox.checked = true;
        } else {
            document.body.dataset.theme = 'light';
            themeToggleCheckbox.checked = false;
        }
        localStorage.setItem('pmuTheme', theme);
    };

    const savedTheme = localStorage.getItem('pmuTheme') || 'light';
    applyTheme(savedTheme);

    themeToggleCheckbox.addEventListener('change', () => {
        const newTheme = themeToggleCheckbox.checked ? 'dark' : 'light';
        applyTheme(newTheme);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    cache.cleanup().then(() => console.log("Nettoyage du cache terminé."));
    setupNavigation();
    setupTheme();
    stateManager.subscribe(renderApp);
    connectEventListeners();
    stateManager.initialize();
});

function connectEventListeners() {
    const addListener = (id, event, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        }
    };

    addListener('loadProgramButton', 'click', () => {
        const dateVal = document.getElementById('dateInput').value;
        if (dateVal) stateManager.changeDate(dateVal);
    });
    addListener('toggleDailyAnalysis', 'change', e => {
        stateManager.setState({ isDailyAnalysisEnabled: e.target.checked });
        // Recharge la journée pour appliquer le changement
        const dateVal = document.getElementById('dateInput').value;
        if (dateVal) stateManager.changeDate(dateVal);
    });
    addListener('reunionSelect', 'change', e => stateManager.selectReunion(e.target.value));
    addListener('courseSelect', 'change', e => stateManager.selectCourse(e.target.value));

    const statsContainer = document.getElementById('stats-container');
    if (statsContainer) {
        statsContainer.addEventListener('click', e => {
            if (e.target.closest('#criteria-profile-btn')) {
                stateManager.openCriteriaModal();
                return;
            }
            const criteriaChip = e.target.closest('.criteria-chip');
            if (criteriaChip) {
                stateManager.updateStatsUI({ currentCriteria: criteriaChip.dataset.criteria });
                return;
            }
            const card = e.target.closest('.stat-card');
            if (card && !card.classList.contains('non-partant')) {
                if (e.target.closest('.stat-card-data')) {
                    const dataElement = e.target.closest('.stat-card-data');
                    const clickedValue = dataElement.dataset.value;
                    const key = dataElement.dataset.key;
                    if (clickedValue === 'null' || clickedValue === 'undefined' || clickedValue === 'N/A') return;
                    const participantsData = stateManager.getState().participantsData;
                    const criterion = EXPLORER_CRITERIA.find(c => c.key === key);
                    if (!criterion || !participantsData) return;
                    const groupName = `${criterion.label} = ${clickedValue}`;
                    const numericFormats = ['float', 'currency', 'integer', 'percent'];
                    let matchingNumbers = participantsData.num.filter((num, i) => {
                        const originalValue = participantsData[key][i];
                        let comparableValue = (numericFormats.includes(criterion.format) && typeof originalValue === 'number' && !isNaN(originalValue)) ? Math.round(originalValue) : originalValue;
                        return String(comparableValue) === String(clickedValue) && participantsData.statut[i] === 'PARTANT';
                    });
                    if (matchingNumbers.length > 0) showFilterActionModal(matchingNumbers, groupName);
                } else { 
                    const num = parseInt(card.dataset.num, 10);
                    const currentSelection = [...stateManager.getState().ui.stats.manualSelection];
                    const index = currentSelection.indexOf(num);
                    if (index > -1) currentSelection.splice(index, 1); else currentSelection.push(num);
                    stateManager.updateStatsUI({ manualSelection: currentSelection });
                }
            } else if (!card) {
                if (stateManager.getState().ui.stats.manualSelection.length > 0) {
                    stateManager.updateStatsUI({ manualSelection: [] });
                }
            }
        });
    }
    addListener('send-selection-to-filters-btn', 'click', () => {
        const { manualSelection, currentCriteria } = stateManager.getState().ui.stats;
        if (manualSelection.length > 0) {
            const criterion = EXPLORER_CRITERIA.find(c => c.key === currentCriteria);
            const groupName = criterion ? `Sélection (${criterion.label})` : 'Sélection Manuelle';
            showFilterActionModal(manualSelection, groupName);
        }
    });
    addListener('sort-toggle-btn', 'click', () => {
        const currentSort = stateManager.getState().ui.stats.sortState.by;
        stateManager.updateStatsUI({ sortState: { by: currentSort === 'num' ? 'data' : 'num' } });
    });
    const scrollerContainer = document.getElementById('criteria-selector-container');
    if (scrollerContainer) {
        addListener('scroll-start-btn', 'click', () => scrollerContainer.scrollTo({ left: 0, behavior: 'smooth' }));
        addListener('scroll-middle-btn', 'click', () => scrollerContainer.scrollTo({ left: (scrollerContainer.scrollWidth - scrollerContainer.clientWidth) / 2, behavior: 'smooth' }));
        addListener('scroll-end-btn', 'click', () => scrollerContainer.scrollTo({ left: scrollerContainer.scrollWidth, behavior: 'smooth' }));
    }
    
    addListener('fonction', 'change', e => {
        const filterName = e.target.value;
        if (!filterName) return;
        stateManager.getState().filters.forEach(f => f.isCollapsed = true);
        const newFilter = { name: filterName, active: true, isCollapsed: false };
        if (filterName === 'VECT') { newFilter.min = '1'; newFilter.max = '1'; }
        if (filterName === 'SOM' || filterName === 'GAP') { newFilter.column = 'num'; }
        if (filterName === 'ORDER') { newFilter.percentage = '50'; newFilter.column = 'rankCote'; }
        stateManager.addFilter(newFilter);
        e.target.value = '';
    });
    addListener('generer', 'click', () => {
        const betSelect = document.getElementById('nbCombinaison');
        const limitInput = document.getElementById('limitInput');
        if (betSelect && limitInput) {
            const betType = parseInt(betSelect.value, 10);
            const betName = betSelect.options[betSelect.selectedIndex].text;
            const limit = parseInt(limitInput.value, 10) || 10000;
            stateManager.runCalculation(betType, betName, limit);
        }
    });
    const functionsList = document.getElementById('functions-list');
    if (functionsList) {
        // Pour les changements instantanés (menus déroulants, cases à cocher)
        functionsList.addEventListener('input', e => {
            const target = e.target;
            if (target.tagName !== 'SELECT' && target.type !== 'checkbox') return;

            const item = target.closest('.function-item[data-index]');
            if (!item) return;
            const index = parseInt(item.dataset.index, 10);
            const field = target.dataset.field;
            const value = target.type === 'checkbox' ? target.checked : target.value;
            stateManager.updateFilter(index, field, value);
        });

        // Pour les champs de texte et numériques, on attend que l'utilisateur quitte le champ
        functionsList.addEventListener('change', e => {
            const target = e.target;
            if (target.tagName !== 'INPUT' || target.type === 'checkbox') return;

            const item = target.closest('.function-item[data-index]');
            if (!item) return;
            const index = parseInt(item.dataset.index, 10);
            const field = target.dataset.field;
            const value = target.value;
            stateManager.updateFilter(index, field, value);
        });

        functionsList.addEventListener('click', e => {
            const item = e.target.closest('.function-item[data-index]');
            if (!item) return;
            const index = parseInt(item.dataset.index, 10);
            if (e.target.closest('.delete-btn')) {
                stateManager.deleteFilter(index); return;
            }
            if (e.target.closest('.spinner-btn')) {
                const input = e.target.parentElement.querySelector('input[type="number"]');
                if (input) {
                    let value = parseInt(input.value, 10) || 0;
                    value += e.target.classList.contains('plus') ? 1 : -1;
                    input.value = Math.max(0, value);
                    stateManager.updateFilter(index, input.dataset.field, input.value);
                }
                return;
            }
            if (e.target.closest('.function-header') && !e.target.closest('.function-header-actions')) {
                stateManager.toggleFilterCollapsed(index);
            }
        });
    }
    
    addListener('champReduitToggle', 'change', e => stateManager.toggleChampReduit(e.target.checked));

    const modal = document.getElementById('filter-action-modal');
    if (modal) {
        modal.addEventListener('click', e => {
            if (e.target === modal || e.target.closest('#modal-cancel-btn')) hideFilterActionModal();
            else if (e.target.closest('#modal-create-vect-btn')) handleCreateFilterFromModal('VECT');
            else if (e.target.closest('#modal-create-order-btn')) handleCreateFilterFromModal('ORDER');
            else if (e.target.closest('#modal-create-som-btn')) handleCreateFilterFromModal('SOM');
            else if (e.target.closest('#modal-create-gap-btn')) handleCreateFilterFromModal('GAP');
        });
    }
    const criteriaModal = document.getElementById('criteria-profile-modal');
    if (criteriaModal) {
        criteriaModal.addEventListener('click', e => {
            if (e.target.closest('#modal-cancel-profile-btn')) stateManager.closeCriteriaModal();
            else if (e.target.closest('#modal-save-profile-btn')) stateManager.saveCriteriaProfile();
            else if (e.target.closest('#modal-apply-profile-btn')) stateManager.applyCriteriaProfile();
            else if (e.target.closest('#modal-delete-profile-btn')) stateManager.deleteCriteriaProfile();
        });
        criteriaModal.addEventListener('change', e => {
            if (e.target.id === 'profile-select') stateManager.selectProfileInModal(e.target.value);
            if (e.target.closest('#criteria-profile-list') && e.target.type === 'checkbox') {
                const newSelectedKeys = Array.from(
                    criteriaModal.querySelectorAll('#criteria-profile-list input[type="checkbox"]:checked')
                ).map(checkbox => checkbox.dataset.criteriaKey);
                stateManager.updateCriteriaModal({ selectedKeys: newSelectedKeys });
            }
        });
        criteriaModal.addEventListener('input', e => {
            if (e.target.id === 'profile-name-input') stateManager.updateCriteriaModal({ currentName: e.target.value });
        });
    }

    addListener('strategie-notes', 'change', e => stateManager.saveNoteForCurrentRace(e.target.value));
    addListener('import-strategie-input', 'change', e => {
        if (e.target.files.length > 0) {
            stateManager.importStrategy(e.target.files[0]);
            e.target.value = null; 
        }
    });

    document.body.addEventListener('click', e => {
        if (e.target.closest('#export-strategie-btn')) stateManager.exportStrategy();
        if (e.target.closest('#import-strategie-btn')) document.getElementById('import-strategie-input')?.click();
        if (e.target.id === 'saveFilterSetBtn') {
            const name = prompt("Nom de l'ensemble de filtres :");
            if (name) stateManager.saveCurrentFilterSet(name);
        }
        if (e.target.id === 'deleteFilterSetBtn') {
            const state = stateManager.getState();
            if (state.selectedFilterSetId) stateManager.deleteFilterSet(state.selectedFilterSetId);
        }
    });
    document.body.addEventListener('change', e => {
        if (e.target.id === 'filterSetSelect') {
            stateManager.applyFilterSet(e.target.value);
        }
    });
}