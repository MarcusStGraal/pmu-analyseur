// js/ui.js
import { factorizeCombinations, getUniqueValuesFromGrille } from './processing.js';

function escapeHTML(unsafe) {
    if (typeof unsafe === 'number') return unsafe.toString();
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/[&<>"']/g, match => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'})[match]);
}
function formatCurrency(value) {
    // Supprime les .00 inutiles
    return parseFloat(value.toFixed(2)).toString().replace('.', ',') + ' €';
}
const DOM = {
    status: document.getElementById('status'),
    reunionSelect: document.getElementById('reunionSelect'),
    courseSelect: document.getElementById('courseSelect'),
    selectionContainer: document.getElementById('selectionContainer'),
    reunionInfoDiv: document.getElementById('reunionInfoDiv'),
    courseInfoDiv: document.getElementById('courseInfoDiv'),
    nonPartantsInfoDiv: document.getElementById('nonPartantsInfoDiv'),
    statsPlaceholder: document.getElementById('stats-placeholder'),
    statsContent: document.getElementById('stats-container'),
    statsTitle: document.getElementById('stats-title'),
    criteriaSelector: document.getElementById('criteria-selector-container'),
    statsExplorerGrid: document.getElementById('stats-explorer-grid'),
    sortToggleButton: document.getElementById('sort-toggle-btn'),
    filtersPlaceholder: document.getElementById('filters-placeholder'),
    filtersContent: document.getElementById('filters-content'),
    filtersTitle: document.getElementById('filters-title'),
    genererButton: document.getElementById('generer'),
    functionsList: document.getElementById('functions-list'),
    activeFilterCount: document.getElementById('active-filter-count'),
    resultsPlaceholder: document.getElementById('results-placeholder'),
    resultsContent: document.getElementById('results-content'),
    resultsTitle: document.getElementById('results-title'),
    resultsHeader: document.getElementById('results-header'),
    resultsWarning: document.getElementById('results-warning'),
    resultsDisplayArea: document.getElementById('results-display-area'),
    champReduitToggle: document.getElementById('champReduitToggle'),
    modal: document.getElementById('filter-action-modal'),
    modalInfoText: document.getElementById('modal-info-text'),
    sendSelectionButton: document.getElementById('send-selection-to-filters-btn'),
    filterSetManager: document.getElementById('filter-set-manager'),
    filtersStatusMessage: document.getElementById('filters-status-message'),
    criteriaProfileModal: document.getElementById('criteria-profile-modal'),
    profileSelect: document.getElementById('profile-select'),
    profileNameInput: document.getElementById('profile-name-input'),
    criteriaProfileList: document.getElementById('criteria-profile-list'),
    strategiePlaceholder: document.getElementById('strategie-placeholder'),
    strategieContent: document.getElementById('strategie-content'),
    strategieRaceSummary: document.getElementById('strategie-race-summary'),
    strategieNotes: document.getElementById('strategie-notes'),
    standardFiltersUI: document.getElementById('standard-filters-ui'),
    distributionUI: document.getElementById('distribution-ui'),
    filtersActionFooter: document.getElementById('filters-action-footer'),
    nbCombinaison: document.getElementById('nbCombinaison')
};

if (DOM.status) {
    DOM.status.setAttribute('aria-live', 'polite');
}

function updateTabTitles(state) {
    const { selectedReunionNum, selectedCourseNum, currentRaceDifficulty } = state;
    const color = currentRaceDifficulty ? currentRaceDifficulty.color : 'inherit';
    if (selectedReunionNum && selectedCourseNum) {
        const raceSuffix = ` R${selectedReunionNum}C${selectedCourseNum}`;
        if (DOM.statsTitle) {
            DOM.statsTitle.textContent = `ANALYSE${raceSuffix}`;
            DOM.statsTitle.style.color = color;
        }
        if (DOM.filtersTitle) {
            DOM.filtersTitle.textContent = `MES FILTRES${raceSuffix}`;
            DOM.filtersTitle.style.color = color;
        }
        if (DOM.resultsTitle) {
            DOM.resultsTitle.textContent = `MES TICKETS${raceSuffix}`;
            DOM.resultsTitle.style.color = color;
        }
    } else {
        if (DOM.statsTitle) DOM.statsTitle.textContent = 'Analyse des Partants';
        if (DOM.filtersTitle) DOM.filtersTitle.textContent = 'Mes Filtres';
        if (DOM.resultsTitle) DOM.resultsTitle.textContent = 'Mes Tickets';
        [DOM.statsTitle, DOM.filtersTitle, DOM.resultsTitle].forEach(el => el && (el.style.color = 'inherit'));
    }
}


export function setupNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    switchTab('selection');
}

export function switchTab(tabId) {
    document.body.classList.toggle('filters-tab-active', tabId === 'filters');
    document.body.classList.toggle('stats-tab-active', tabId === 'stats');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabId}`);
    });
}

export const EXPLORER_CRITERIA = [
    { key: 'cote', label: 'Cote', unit: '/1', format: 'float', defaultAsc: true, rankable: true },
    { key: 'indiceForme', label: 'Ind. Forme', unit: '', format: 'float', defaultAsc: true, rankable: true },
    { key: 'gainsParCourse', label: 'Gains/Crs', unit: '€', format: 'currency', defaultAsc: false, rankable: true },
    { key: 'coursesApresAbsence', label: 'Crs Rentrée', unit: '', format: 'integer', defaultAsc: false, rankable: true },
    { key: 'chevauxBattus3d', label: 'Adv. Battus', unit: '', format: 'integer', defaultAsc: false, rankable: true },
    { key: 'chevauxBattus3dPct', label: 'Adv. Battus %', unit: '%', format: 'percent', defaultAsc: false, rankable: true },
    { key: 'unite', label: 'Unité', unit: '', format: 'boolean', defaultAsc: false, rankable: true },
    { key: 'parite', label: 'Parité', unit: '', format: 'boolean', defaultAsc: false, rankable: true },
    { key: 'ecartDistance', label: 'Δ Dist. Perso', unit: '', format: 'integer', defaultAsc: true, rankable: true },
    { key: 'formeMontante', label: 'Forme Mont.', unit: '', format: 'boolean', defaultAsc: false, rankable: true },    
    { key: 'nbPlaces_3d', label: 'Podiums (3d)', unit: '', format: 'integer', defaultAsc: false, rankable: true },
    { key: 'meilleurePerfAbsolue_5d', label: 'Meilleure Perf (5d)', unit: '', format: 'integer', defaultAsc: true, rankable: true },
    { key: 'nbCoursesHippo', label: 'Nb Hippo', unit: '', format: 'integer', defaultAsc: false, rankable: true },
    { key: 'dernierePerfNorm', label: 'Dern. Perf.', unit: '', format: 'integer', defaultAsc: true, rankable: true }, 
    { key: 'evolPerf', label: 'Évol. Perf.', unit: '', format: 'integer', defaultAsc: false, rankable: true }, 
    { key: 'moyennePerfAnnee', label: 'Moy. Perf.', unit: '', format: 'float', defaultAsc: true, rankable: true }, 
    { key: 'nbCoursesCarriere', label: 'Nb Courses', unit: '', format: 'integer', defaultAsc: false, rankable: true }, 
    { key: 'influenceJockey', label: 'Infl. Jockey', unit: '', format: 'integer', defaultAsc: false, rankable: true }, 
    { key: 'influenceEntraineur', label: 'Infl. Entraîn.', unit: '', format: 'integer', defaultAsc: false, rankable: true }, 
    { key: 'influencePere', label: 'Infl. Père', unit: '', format: 'integer', defaultAsc: false, rankable: true }, 
    { key: 'poids', label: 'Poids', unit: 'kg', format: 'float', defaultAsc: false, rankable: true, disciplines: ['PLAT', 'OBSTACLE', 'TROT_MONTE'] }, 
    { key: 'valeur', label: 'Val. Hand.', unit: '', format: 'float', defaultAsc: false, rankable: true, disciplines: ['PLAT', 'OBSTACLE'] }, 
    { key: 'age', label: 'Âge', unit: ' ans', format: 'integer', defaultAsc: true, rankable: true }, 
    { key: 'sexe', label: 'Sexe', unit: '', format: 'string', defaultAsc: true },
    { key: 'corde', label: 'Corde', unit: '', format: 'integer', defaultAsc: true, rankable: true }, 
    { key: 'def', label: 'Déferré', unit: '', format: 'integer', defaultAsc: false, rankable: true }, 
    { key: 'gainsCarriere', label: 'Gains Carr.', unit: '€', format: 'currency', defaultAsc: false, rankable: true }, 
    { key: 'gainsAnneeEnCours', label: 'Gains 2025', unit: '€', format: 'currency', defaultAsc: false, rankable: true }, 
    { key: 'gainsAnneePrecedente', label: 'Gains 2024', unit: '€', format: 'currency', defaultAsc: false, rankable: true }, 
    { key: 'gainsVictoires', label: 'Gains Victoires', unit: '€', format: 'currency', defaultAsc: false, rankable: true },
    { key: 'gainsPlace', label: 'Gains Places', unit: '€', format: 'currency', defaultAsc: false, rankable: true },
    { key: 'ecartJours', label: 'Fraîcheur', unit: 'j', format: 'integer', defaultAsc: true, rankable: true }, 
    { key: 'dernierMemeHippo', label: 'Dern. Même Hippo', unit: '', format: 'boolean' }, 
    { key: 'dernierNbPartants', label: 'Dern. Nb Partants', unit: '', format: 'integer', defaultAsc: false, rankable: true }, 
    { key: 'sum_allocations_3d', label: 'Alloc. 3D', unit: '€', format: 'currency', defaultAsc: false, rankable: true }, 
    { key: 'ecartPoids', label: 'Δ Poids', unit: 'kg', format: 'integer', defaultAsc: true, rankable: true, disciplines: ['PLAT', 'OBSTACLE', 'TROT_MONTE'] }, 
    { key: 'driverChange', label: 'Chg. Driver', unit: '', format: 'boolean' }, 
    { key: 'reussiteHippo', label: 'Tx Hippo', unit: '%', format: 'percent', defaultAsc: false, rankable: true }, 
    { key: 'reussiteDistance', label: 'Tx Dist.', unit: '%', format: 'percent', defaultAsc: false, rankable: true }, 
    { key: 'oeilleres', label: 'Œillères', unit: '', format: 'string', defaultAsc: true }, 
    { key: 'lettre_1', label: 'Lettre 1', unit: '', format: 'string', defaultAsc: true }, 
    { key: 'lettre_2', label: 'Lettre 2', unit: '', format: 'string', defaultAsc: true },
    { key: 'recordVitesseHippo', label: 'Record Hippo', unit: 's', format: 'float', defaultAsc: true, rankable: true, disciplines: ['TROT_ATTELE', 'TROT_MONTE'] },
    { key: 'rkAdjusted', label: 'RK Ajustée', unit: '', format: 'integer', defaultAsc: true, rankable: true, disciplines: ['TROT_ATTELE', 'TROT_MONTE'] },
    { key: 'dernierReducKm', label: 'Dern. Réduc. Km', unit: '', format: 'string', defaultAsc: true, rankable: true, disciplines: ['TROT_ATTELE', 'TROT_MONTE'] },    
    { key: 'recordVitessePlatHippo', label: 'Record Vitesse', unit: 'm/s', format: 'float', defaultAsc: false, rankable: true, disciplines: ['PLAT', 'GALOP', 'OBSTACLE'] },
];

const FILTER_FUNCTION_COLUMNS = [
    { value: 'num', label: 'N°' }, { value: 'age', label: 'Age' }, { value: 'sexe', label: 'Sexe' }, { value: 'poids', label: 'Poids' }, { value: 'corde', label: 'Corde' }, { value: 'valeur', label: 'Val.Hand.' }, { value: 'cote', label: 'Cotes' }, { value: 'gainsCarriere', label: 'Gains' }, { value: 'gainsVictoires', label: 'Gains Victoires' }, { value: 'gainsPlace', label: 'Gains Places' }, { value: 'def', label: 'Déferré' }, { value: 'dernierePerfNorm', label: 'Dern. Perf' }, { value: 'evolPerf', label: 'Évol. Perf' }, { value: 'moyennePerfAnnee', label: 'Moy. Perf' }, { value: 'nbCoursesCarriere', label: 'Nb Courses' }, { value: 'dernierReducKm', label: 'Dern. Réduc. Km' }, { value: 'dernierMemeHippo', label: 'Dern. Même Hippo' }, { value: 'dernierNbPartants', label: 'Dern. Nb Partants' }, { value: 'influenceJockey', label: 'Infl. Jockey' }, { value: 'influenceEntraineur', label: 'Infl. Entraîn.' }, { value: 'influencePere', label: 'Infl. Père' },
    { value: 'nbPlaces_3d', label: 'Nb Podiums (3d)'}, { value: 'meilleurePerfAbsolue_5d', label: 'Meilleure Perf (5d)' },
    { value: 'rkAdjusted', label: 'RK Ajustée' }, { value: 'nbCoursesHippo', label: 'Nb Hippo' },
    { value: 'rankNbPlaces_3d', label: 'Rg Podiums (3d)'}, { value: 'rankMeilleurePerfAbsolue_5d', label: 'Rg Meilleure Perf (5d)' },
    { value: 'rankCote', label: 'Rg Cote' }, { value: 'rankGains', label: 'Rg Gains' }, { value: 'rankGainsVictoires', label: 'Rg Gains Vict.' }, { value: 'rankGainsPlace', label: 'Rg Gains Places' }, { value: 'rankPoids', label: 'Rg Poids' }, { value: 'rankValeur', label: 'Rg Valeur' }, { value: 'rankEcartJours', label: 'Rg Fraîch.' }, { value: 'rankRkAdjusted', label: 'Rg RK Ajustée' }, { value: 'rankReussiteHippo', label: 'Rg Tx Hippo' }, { value: 'rankReussiteDistance', label: 'Rg Tx Dist.' },
];

let combinationRenderTimeout = null;
let currentNumbersForModal = [];
let currentGroupNameForModal = '';

export function renderApp(state) {
    document.body.classList.toggle('is-loading', state.isLoading);
    updateStatus(state.status.message, state.status.isError);
    updateTabTitles(state);

    if (state.programmeData && state.programmeData.programme) {
        const timeZoneOffset = state.programmeData.programme.timeZoneOffset || 0;
        populateReunionSelect(state.programmeData.programme.reunions, state.selectedReunionNum, timeZoneOffset);
        showSelectionContainer();
        const selectedReunion = state.programmeData.programme.reunions.find(r => r.numOfficiel == state.selectedReunionNum);
        if(selectedReunion) {
            populateCourseSelect(selectedReunion.courses, state.selectedCourseNum, timeZoneOffset);            
            displayReunionInfo(selectedReunion);
            const selectedCourse = selectedReunion.courses.find(c => c.numExterne == state.selectedCourseNum);
            if(selectedCourse) {
                 displayCourseInfo(selectedCourse, state.currentRaceDifficulty);
            }
        }
    }

    if (state.participantsData) {
        displayNonPartantsInfo(state.participantsData);
        const activeProfile = state.criteriaProfiles.find(p => p.id === state.activeCriteriaProfileId) || state.criteriaProfiles[0];
        
        const criteriaProfileBtn = document.getElementById('criteria-profile-btn');
        if (criteriaProfileBtn && activeProfile) {
            criteriaProfileBtn.textContent = activeProfile.name;
        }

        renderStatsExplorer(state.participantsData, activeProfile, state.ui.stats.currentCriteria, state.ui.stats.sortState, state.ui.stats.manualSelection, state.participantsData.arrivalRanks, state.ui.stats.displayMode, state.isDailyAnalysisEnabled);
        updateSendSelectionButton(state.ui.stats.manualSelection);
        activateFiltersTab(true);
        renderFiltersContent(state);
    } else {
        renderStatsExplorer(null);
        activateFiltersTab(false);
        renderFiltersContent(state);
    }

    updateFunctionsList(state.filters, state.participantsData);
    renderStrategieTab(state);
    
    if (DOM.criteriaProfileModal) {
        if (state.ui.isCriteriaModalOpen) {
            const discipline = state.participantsData ? state.participantsData.discipline : null;
            renderCriteriaProfileModal(state.criteriaProfiles, state.ui.criteriaModal, discipline);
            DOM.criteriaProfileModal.style.display = 'flex';
        } else {
            DOM.criteriaProfileModal.style.display = 'none';
        }
    }

    const { combinations, betName, betType, limitReached, showChampReduit } = state.results;
    if (DOM.champReduitToggle) DOM.champReduitToggle.checked = showChampReduit;
    if (DOM.nbCombinaison) DOM.nbCombinaison.value = betType;

    updateResultsTab(combinations.length, betName, betType, limitReached);
    renderCombinationsProgressively(combinations, betType, showChampReduit);
}

export function showFilterActionModal(numeros, groupName) {
    currentNumbersForModal = numeros;
    currentGroupNameForModal = groupName;
    if (DOM.modalInfoText) DOM.modalInfoText.textContent = `Créer un filtre basé sur le groupe "${escapeHTML(groupName)}" (Numéros: ${numeros.join(', ')}) ?`;
    if (DOM.modal) DOM.modal.style.display = 'flex';
}

export function hideFilterActionModal() {
    if (DOM.modal) DOM.modal.style.display = 'none';
    currentNumbersForModal = [];
    currentGroupNameForModal = '';
}

export function getCurrentModalNumbers() {
    return currentNumbersForModal;
}

export function getCurrentModalGroupName() {
    return currentGroupNameForModal;
}

export function updateStatus(message, isError = false) {
    if (!DOM.status) return;
    DOM.status.textContent = message;
    DOM.status.style.color = isError ? 'var(--danger-color)' : 'var(--text-color-light)';
}

export function updateSendSelectionButton(selection) {
    if (!DOM.sendSelectionButton) return;
    const selectionCount = Array.isArray(selection) ? selection.length : 0;
    DOM.sendSelectionButton.style.visibility = selectionCount > 0 ? 'visible' : 'hidden';
    if (selectionCount > 0) {
        const countSpan = DOM.sendSelectionButton.querySelector('span');
        if (countSpan) countSpan.textContent = selectionCount;
    }
}

export function populateReunionSelect(reunions, selectedReunionNum, timeZoneOffset) {
    if (!DOM.reunionSelect) return;
    DOM.reunionSelect.innerHTML = '<option value="" disabled>Réunion</option>';
    if (!Array.isArray(reunions)) return;

    reunions.forEach(reunion => {
        const option = document.createElement('option');
        option.value = reunion.numOfficiel;
        
        const isQuinteReunion = reunion.courses && reunion.courses.some(c => c.paris?.some(p => p.typePari === 'QUINTE_PLUS'));
        if (isQuinteReunion) {
            option.classList.add('quinte-option');
        }

        let heurePremiereCourse = '';
        if (reunion.courses && reunion.courses.length > 0) {
             const premiereCourse = [...reunion.courses].sort((a,b) => a.numOrdre - b.numOrdre)[0];
             if (premiereCourse && premiereCourse.heureDepart) {
                heurePremiereCourse = new Intl.DateTimeFormat('fr-FR', {
                    timeZone: 'Europe/Paris',
                    hour: '2-digit',
                    minute: '2-digit'
                }).format(premiereCourse.heureDepart);
             }
        }
        const textParts = [heurePremiereCourse, `R${reunion.numOfficiel}`, `- ${escapeHTML(reunion.hippodrome.libelleCourt)}`];
        option.textContent = textParts.filter(Boolean).join(' ');
        if (isQuinteReunion) {
            option.textContent += ' ★ Quinté+';
        }
        DOM.reunionSelect.appendChild(option);
    });
    DOM.reunionSelect.value = selectedReunionNum || '';
    if(!selectedReunionNum) DOM.reunionSelect.selectedIndex = 0;
    DOM.reunionSelect.disabled = false;
}

export function populateCourseSelect(courses, selectedCourseNum, timeZoneOffset) {
    if (!DOM.courseSelect) return;
    DOM.courseSelect.innerHTML = '<option value="" disabled>Course</option>';
    if (!Array.isArray(courses)) return;
    courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.numExterne;
        
        const isQuinteCourse = course.paris && course.paris.some(p => p.typePari === 'QUINTE_PLUS');
        if (isQuinteCourse) {
            option.classList.add('quinte-option');
        }

        const heure = course.heureDepart ? new Intl.DateTimeFormat('fr-FR', {
            timeZone: 'Europe/Paris',
            hour: '2-digit',
            minute: '2-digit'
        }).format(course.heureDepart) : '';

        const partantsCount = course.nombrePartants || course.nombreDeclaresPartants;
        const partantsText = partantsCount ? `${partantsCount}p` : '';
        
        let discipline = course.specialite || course.discipline;
        discipline = discipline ? discipline.replace(/TROT_|OBSTACLE/g, '') : '';
        const disciplineText = discipline ? `(${discipline})` : '';

        let courseName = course.libelle;
        if (isQuinteCourse) {
            courseName = `★ ${courseName}`;
        }
        const textParts = [heure, partantsText, `C${course.numExterne}`, disciplineText, `- ${courseName}`];
        option.textContent = textParts.filter(Boolean).join(' ');
        DOM.courseSelect.appendChild(option);
    });
    DOM.courseSelect.value = selectedCourseNum || '';
    if(!selectedCourseNum) DOM.courseSelect.selectedIndex = 0;
    DOM.courseSelect.disabled = false;
}

export function displayReunionInfo(reunion) {
    if (reunion && reunion.meteo) {
        const m = reunion.meteo;
        DOM.reunionInfoDiv.innerHTML = `<strong>Météo :</strong> ${escapeHTML(m.nebulositeLibelleLong)} (${m.temperature}°C, Vent ${m.forceVent}km/h ${escapeHTML(m.directionVent)})`;
        DOM.reunionInfoDiv.style.display = 'block';
    } else {
        DOM.reunionInfoDiv.style.display = 'none';
    }
}

export function displayCourseInfo(course, difficulty) {
    let content = '';
    if (course && course.conditions) {
        content += `<strong>Conditions :</strong> ${escapeHTML(course.conditions)}`;
    }
    if (difficulty) {
        content += `<br><strong>Indice Difficulté :</strong> <span style="color:${difficulty.color}; font-weight:bold;">${difficulty.score}/100 (${difficulty.level})</span>`;
    }

    if (content) {
        DOM.courseInfoDiv.innerHTML = content;
        DOM.courseInfoDiv.style.display = 'block';
    } else {
        DOM.courseInfoDiv.style.display = 'none';
    }
}

export function displayNonPartantsInfo(participantsData) {
    const nonPartants = participantsData.num.map((num, i) => ({
        num: num,
        nom: participantsData.nom[i],
        statut: participantsData.statut[i]
    })).filter(p => p.statut !== 'PARTANT');
    
    if (nonPartants.length > 0) {
        const npList = nonPartants.map(p => `${p.num} - ${escapeHTML(p.nom)}`).join(', ');
        DOM.nonPartantsInfoDiv.innerHTML = `<strong>Non-partant(s) :</strong> ${npList}`;
        DOM.nonPartantsInfoDiv.classList.add('non-partant');
        DOM.nonPartantsInfoDiv.style.display = 'block';
    } else {
        DOM.nonPartantsInfoDiv.style.display = 'none';
    }
}

export function showSelectionContainer() {
    if (DOM.selectionContainer) DOM.selectionContainer.style.display = 'block';
}

export function resetUI() {
    if (DOM.selectionContainer) DOM.selectionContainer.style.display = 'none';
    if (DOM.reunionSelect) {
        DOM.reunionSelect.innerHTML = '<option value="" disabled selected>Réunion</option>';
        DOM.reunionSelect.disabled = true;
    }
    resetCourseSelection();
    updateResultsTab(0, '', 0);
    updateStatus('Veuillez sélectionner une date.', false);
}

export function resetCourseSelection() {
    if (DOM.courseSelect) {
        DOM.courseSelect.innerHTML = '<option value="" disabled selected>Course</option>';
        DOM.courseSelect.disabled = true;
    }
    if (DOM.reunionInfoDiv) DOM.reunionInfoDiv.style.display = 'none';
    if (DOM.courseInfoDiv) DOM.courseInfoDiv.style.display = 'none';
    if (DOM.nonPartantsInfoDiv) DOM.nonPartantsInfoDiv.style.display = 'none';
    activateFiltersTab(false);
    renderStatsExplorer(null, null, 'cote', { by: 'num' }, [], null);
}

function populateCriteriaSelector(criteriaKey, visibleCriteria) {
    if (!DOM.criteriaSelector) return;
    
    DOM.criteriaSelector.innerHTML = visibleCriteria.map(c => `
        <button type="button" class="criteria-chip ${c.key === criteriaKey ? 'active' : ''}" data-criteria="${c.key}" draggable="true">
            ${escapeHTML(c.label)}
        </button>
    `).join('');
}

export function renderStatsExplorer(grille, activeProfile, criteriaKey, sortState, selection, arrivalRanks, displayMode = 'value', isDailyAnalysisEnabled) {
    selection = selection || [];
    arrivalRanks = arrivalRanks || {};
    const isGrilleAvailable = !!grille;

    if (DOM.statsPlaceholder) DOM.statsPlaceholder.style.display = isGrilleAvailable ? 'none' : 'block';
    if (DOM.statsContent) DOM.statsContent.style.display = isGrilleAvailable ? 'block' : 'none';

    if (!isGrilleAvailable || !activeProfile) {
        if (DOM.criteriaSelector) DOM.criteriaSelector.innerHTML = '';
        return;
    }

    const influenceKeys = ['influenceJockey', 'influenceEntraineur', 'influencePere'];
    
    const visibleCriteria = activeProfile.criteriaKeys.map(key => {
        return EXPLORER_CRITERIA.find(c => c.key === key);
    }).filter(criterion => {
        if (!criterion) return false;
        if (criterion.disciplines && !criterion.disciplines.includes(grille.discipline)) return false;
        if (!isDailyAnalysisEnabled && influenceKeys.includes(criterion.key)) return false;
        return true;
    });

    populateCriteriaSelector(criteriaKey, visibleCriteria);

    const participantsArray = grille.num.map((num, i) => {
        const participant = {};
        for (const key in grille) {
            if (grille.hasOwnProperty(key)) {
                participant[key] = grille[key][i];
            }
        }
        return participant;
    });

    const criterion = EXPLORER_CRITERIA.find(c => c.key === criteriaKey);
    const sortKey = sortState.by === 'data' ? criteriaKey : 'num';
    const sortAscending = (sortState.by === 'data' && criterion) ? criterion.defaultAsc : true;

    participantsArray.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (valA === null || valA === '') return 1;
        if (valB === null || valB === '') return -1;
        if (criterion?.format === 'string') {
            return sortAscending ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
        } else {
            return sortAscending ? valA - valB : valB - valA;
        }
    });

    if (DOM.sortToggleButton) {
        const sortLabel = criterion ? criterion.label : 'N°';
        DOM.sortToggleButton.textContent = sortState.by === 'data' ? sortLabel : 'N°';
    }
    if (DOM.statsExplorerGrid) {
        DOM.statsExplorerGrid.innerHTML = buildExplorerGridHTML(participantsArray, criterion, selection, arrivalRanks, displayMode);
    }
}

export function activateFiltersTab(isActive) {
    if (DOM.filtersPlaceholder) DOM.filtersPlaceholder.style.display = isActive ? 'none' : 'block';
    if (DOM.filtersContent) DOM.filtersContent.style.display = isActive ? 'block' : 'none';
}

export function updateFunctionsList(functions, grille) {
    const activeCount = functions.filter(f => f.active !== false).length;
    if (DOM.activeFilterCount) {
        DOM.activeFilterCount.textContent = activeCount;
        DOM.activeFilterCount.classList.toggle('visible', activeCount > 0);
    }
    if (!DOM.functionsList) return;
    if (functions.length === 0) {
        DOM.functionsList.innerHTML = '<p class="placeholder-text">Ajoutez un filtre pour commencer ou chargez un ensemble.</p>';
        return;
    }

    const influenceKeys = ['influenceJockey', 'influenceEntraineur', 'influencePere'];
    const isDailyAnalysisEnabled = grille && grille.influenceJockey && grille.influenceJockey.some(v => v > 0);
    
    const availableColumns = FILTER_FUNCTION_COLUMNS.filter(c => isDailyAnalysisEnabled || !influenceKeys.includes(c.value));
    const columnOptionsHTML = availableColumns.map(c => `<option value="${c.value}">${c.label}</option>`).join('');

    DOM.functionsList.innerHTML = functions.map((filter, index) => buildFilterItemHTML(filter, index, columnOptionsHTML, grille)).join('');
}

export function updateResultsTab(combinationCount, betName, betSize, limitReached = false) {
    const hasCombinations = combinationCount > 0;
    if (DOM.resultsPlaceholder) DOM.resultsPlaceholder.style.display = hasCombinations ? 'none' : 'block';
    if (DOM.resultsContent) DOM.resultsContent.style.display = hasCombinations ? 'block' : 'none';
    
    if (DOM.resultsWarning) {
        if (hasCombinations && limitReached) {
            DOM.resultsWarning.textContent = `Limite atteinte. Seules les ${combinationCount} premières combinaisons sont affichées.`;
            DOM.resultsWarning.style.display = 'block';
        } else {
            DOM.resultsWarning.style.display = 'none';
        }
    }

    if (!hasCombinations) return;
    
    if (DOM.resultsHeader) {
        let headerText = `<strong>${combinationCount}</strong> combinaisons`;
        if (limitReached) {
            headerText += ` (limite atteinte)`;
        }
        DOM.resultsHeader.innerHTML = headerText;
    }
    
    if (DOM.resultsDisplayArea) DOM.resultsDisplayArea.innerHTML = '';
}

function renderCombinationsProgressively(combinations, betSize, useChampReduit) {
    if (combinationRenderTimeout) cancelAnimationFrame(combinationRenderTimeout);
    if (!combinations || combinations.length === 0) return;

    const displayArea = DOM.resultsDisplayArea;
    if (!displayArea) return;
    
    displayArea.className = `results-display-area ${useChampReduit ? 'list-view' : 'grid-view'}`;
    displayArea.innerHTML = '';

    const chunkSize = 100;
    let index = 0;
    
    const itemsToRender = useChampReduit ? factorizeCombinations(combinations, betSize) : combinations;

    function renderChunk() {
        const fragment = document.createDocumentFragment();
        const endIndex = Math.min(index + chunkSize, itemsToRender.length);
        const chunk = itemsToRender.slice(index, endIndex);

        const html = useChampReduit 
            ? buildListViewHTML(chunk, betSize, true)
            : buildGridViewHTML(chunk);
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        while(tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
        }

        displayArea.appendChild(fragment);
        index = endIndex;

        if (index < itemsToRender.length) {
            combinationRenderTimeout = requestAnimationFrame(renderChunk);
        }
    }

    requestAnimationFrame(renderChunk);
}

function formatDisplayValue(rawValue, criterion, allParticipants, isRank = false) {
    if (isRank) return rawValue;

    if (criterion.format === 'float') {
        if (typeof rawValue === 'number' && !isNaN(rawValue)) {
            rawValue = (rawValue % 1 === 0) ? rawValue.toFixed(0) : rawValue.toFixed(1);
        }
    } else {
        const numericFormats = ['currency', 'integer', 'percent'];
        if (numericFormats.includes(criterion.format)) {
            if (typeof rawValue === 'number' && !isNaN(rawValue)) {
                rawValue = Math.round(rawValue);
            }
        }
    }

    if (rawValue === null || rawValue === undefined) {
        return 'N/A';
    }

    const gainKeys = ['gainsCarriere', 'gainsAnneeEnCours', 'gainsAnneePrecedente', 'gainsParCourse', 'sum_allocations_3d', 'gainsVictoires', 'gainsPlace'];
    if (gainKeys.includes(criterion.key)) {
        const allValues = allParticipants.map(p => p[criterion.key]).filter(v => typeof v === 'number' && v !== null);
        const maxVal = Math.max(...allValues);
        if (maxVal > 0) {
            const percentage = (rawValue / maxVal) * 100;
            return `${percentage.toFixed(0)}%`;
        }
        return '0%';
    }

    switch(criterion.format) {
        case 'currency': return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(rawValue);
        case 'percent': return `${rawValue.toFixed(0)}${criterion.unit || ''}`;
        case 'boolean': return rawValue === 1 ? '1' : '0';
        default: return `${rawValue}${criterion.unit || ''}`;
    }
}

function buildExplorerGridHTML(participants, criterion, selection, arrivalRanks, displayMode) {
    if (!criterion) return '<p>Critère de données non valide.</p>';
    const isRankView = displayMode === 'rank' && criterion.rankable;
    const rankKey = 'rank' + criterion.key.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');

    return participants.map((p, i) => {
        const isSelectedClass = selection.includes(p.num) ? 'selected' : '';
        const arrivalRank = arrivalRanks[p.num];
        const winnerClass = arrivalRank ? `winner-${arrivalRank}` : '';
        const isNonPartantClass = p.statut !== 'PARTANT' ? 'non-partant' : '';

        const displayKey = isRankView ? rankKey : criterion.key;
        let valueForDisplay = p[displayKey];
        const originalValue = p[criterion.key];
        
        let valueForGrouping = originalValue;
        const numericFormats = ['float', 'currency', 'integer', 'percent'];
        if (numericFormats.includes(criterion.format)) {
            if (typeof originalValue === 'number' && !isNaN(originalValue)) {
                valueForGrouping = Math.round(originalValue);
            }
        }
        
        const displayValue = formatDisplayValue(valueForDisplay, criterion, participants, isRankView);
        
        return `
            <div class="stat-card ${isSelectedClass} ${winnerClass} ${isNonPartantClass}" data-num="${p.num}">
                <span class="stat-card-num">${p.num}</span>
                <small class="stat-card-data" data-key="${criterion.key}" data-value="${valueForGrouping}">
                    ${displayValue}
                </small>
            </div>
        `;
    }).join('');
}

function buildFilterItemHTML(filter, index, baseColumnOptions, grille) {
    const isCollapsed = filter.isCollapsed ? 'collapsed' : '';
    const isChecked = filter.active !== false ? 'checked' : '';
    let controlsHtml = '';
    const columnOptions = baseColumnOptions.replace(`value="${filter.column}"`, `value="${filter.column}" selected`);
    switch(filter.name) {
        case 'VECT':
            controlsHtml = `
                <div class="full-width-control">
                    <input type="text" placeholder="Numéros ex: 1 5 8" data-field="vect" value="${escapeHTML(filter.vect || '')}">
                </div>
                ${createSpinner('min', filter.min, 'Min')}
                ${createSpinner('max', filter.max, 'Max')}
            `;
            break;
        case 'SOM': case 'ORDER': case 'KTG': case 'GAP':
            const isDisabled = (filter.vect) ? 'disabled' : '';
            controlsHtml = `<select data-field="column" class="full-width-control" ${isDisabled}>${columnOptions}</select>`;
            break;
    }
    if (filter.name !== 'VECT' && filter.name !== 'ORDER') {
         controlsHtml += createSpinner('min', filter.min, 'Min') + createSpinner('max', filter.max, 'Max');
    } else if (filter.name === 'ORDER') {
         controlsHtml += `<div class="full-width-control">${createSpinner('percentage', filter.percentage, '%')}</div>`;
    }
     if(filter.name === 'GAP' || filter.name === 'KTG') {
        const gapOptions = filter.name === 'GAP' 
            ? `<option value="1" ${filter.value === '1' ? 'selected' : ''}>Écart de 1</option><option value="2" ${filter.value === '2' ? 'selected' : ''}>Écart de 2</option>`
            : `<option value="2" ${filter.value === '2' ? 'selected' : ''}>Paire</option><option value="3" ${filter.value === '3' ? 'selected' : ''}>Brelan</option>`;
        controlsHtml += `<select data-field="value" class="full-width-control">${gapOptions}</select>`;
    }
    return `<div class="function-item ${isCollapsed}" data-index="${index}">
        <div class="function-header">
            <div class="function-title">
                <span class="function-name">${filter.name}</span>
                ${filter.label ? `<span class="function-label-pill" title="${escapeHTML(filter.label)}">${escapeHTML(filter.label)}</span>` : ''}
            </div>
            <div class="function-header-actions">
                <label class="toggle-switch">
                    <input type="checkbox" data-field="active" ${isChecked} title="Activer/Désactiver">
                    <span class="slider"></span>
                </label>
                <i class="fas fa-times delete-btn" title="Supprimer" aria-label="Supprimer le filtre"></i>
            </div>
        </div>
        <div class="function-controls">${controlsHtml}</div>
    </div>`;
}

function createSpinner(field, value, placeholder) {
    return `<div class="spinner-control">
        <button type="button" class="spinner-btn minus" aria-label="Diminuer ${placeholder}">-</button>
        <input type="number" data-field="${field}" value="${value || ''}" placeholder="${placeholder}">
        <button type="button" class="spinner-btn plus" aria-label="Augmenter ${placeholder}">+</button>
    </div>`;
}

function buildGridViewHTML(combinations) {
    return combinations.map(combo => `<span>${combo.join(' ')}</span>`).join('');
}

function buildListViewHTML(combinations, betSize, isAlreadyFactored = false) {
    const factoredResult = isAlreadyFactored ? combinations : factorizeCombinations(combinations, betSize);
    if (factoredResult.length === 0) return '';
    
    return factoredResult.map(group => {
        if (group.isFactored) {
            return `<div class="champ-reduit-group">
                       <strong>${group.base.join(' ')}</strong>
                       <span class="separator">/</span>
                       <span>${group.complements.join(' ')}</span>
                     </div>`;
        } else {
            return `<div class="champ-reduit-group"><strong>${group.base.join(' ')}</strong></div>`;
        }
    }).join('');
}

export function renderCriteriaProfileModal(profiles, modalState, discipline) {
    if (!DOM.profileSelect || !DOM.criteriaProfileList || !DOM.profileNameInput) return;
    DOM.profileSelect.innerHTML = profiles.map(p => 
        `<option value="${p.id}" ${p.id === modalState.selectedProfileId ? 'selected' : ''}>${escapeHTML(p.name)}</option>`
    ).join('');

    DOM.profileNameInput.value = modalState.currentName;

    const availableCriteria = discipline
        ? EXPLORER_CRITERIA.filter(c => !c.disciplines || c.disciplines.includes(discipline))
        : EXPLORER_CRITERIA;

    DOM.criteriaProfileList.innerHTML = availableCriteria.map(c => `
        <label title="${escapeHTML(c.label)}">
            <input type="checkbox" data-criteria-key="${c.key}" ${modalState.selectedKeys.includes(c.key) ? 'checked' : ''}>
            <span>${escapeHTML(c.label)}</span>
        </label>
    `).join('');

    const deleteBtn = document.getElementById('modal-delete-profile-btn');
    const selectedProfile = profiles.find(p => p.id === modalState.selectedProfileId);
    if (deleteBtn) {
        deleteBtn.disabled = !selectedProfile || selectedProfile.isDefault;
    }
}

function renderStrategieTab(state) {
    const isRaceSelected = !!state.participantsData;
    if (!DOM.strategiePlaceholder || !DOM.strategieContent) return;
    
    DOM.strategiePlaceholder.style.display = isRaceSelected ? 'none' : 'block';
    DOM.strategieContent.style.display = isRaceSelected ? 'block' : 'none';

    if (!isRaceSelected) return;

    const reunion = state.programmeData.programme.reunions.find(r => r.numOfficiel == state.selectedReunionNum);
    const course = reunion.courses.find(c => c.numExterne == state.selectedCourseNum);
    const partantsCount = course.nombrePartants || course.nombreDeclaresPartants || '?';
    DOM.strategieRaceSummary.innerHTML = `
        <strong>R${reunion.numOfficiel} / C${course.numExterne}</strong> - ${escapeHTML(course.libelle)}<br>
        <small>${escapeHTML((course.specialite || course.discipline).replace(/_/g, ' '))} - ${course.distance}m - ${partantsCount} partants</small>
    `;

    DOM.strategieNotes.value = state.currentRaceNote || '';

    const savedFilterSets = state.savedFilterSets;
    const selectedFilterSetId = state.selectedFilterSetId;
    const currentFiltersCount = state.filters.length;
    
    const hasSavedSets = savedFilterSets && savedFilterSets.length > 0;
    const options = hasSavedSets
        ? savedFilterSets.map(s => `<option value="${s.id}" ${s.id === selectedFilterSetId ? 'selected' : ''}>${escapeHTML(s.name)}</option>`).join('')
        : '';
    
    if (DOM.filterSetManager) {
        DOM.filterSetManager.innerHTML = `
            <div class="form-group">
                <label for="filterSetSelect">Mes Ensembles de Filtres</label>
                <div class="filter-set-controls">
                    <select id="filterSetSelect" ${!hasSavedSets ? 'disabled' : ''}>
                        <option value="">-- Choisir un ensemble --</option>
                        ${options}
                    </select>
                </div>
            </div>
            <div class="filter-set-buttons">
                <button type="button" id="saveFilterSetBtn" ${currentFiltersCount === 0 ? 'disabled' : ''} title="Sauvegarder les filtres actuels">
                    <i class="fas fa-save"></i>
                </button>
                <button type="button" id="deleteFilterSetBtn" class="btn-danger" ${!selectedFilterSetId ? 'disabled' : ''} title="Supprimer l'ensemble sélectionné">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }
}

function renderFiltersContent(state) {
    if (!DOM.standardFiltersUI || !DOM.distributionUI) return;
    const isRaceSelected = !!state.participantsData;
    const betType = state.results.betType;
    const isSimpleBet = betType === 1;
    if (DOM.filtersActionFooter) {
        DOM.filtersActionFooter.style.display = isSimpleBet ? 'none' : 'flex';
    }
    DOM.standardFiltersUI.style.display = isSimpleBet ? 'none' : 'block';
    DOM.distributionUI.style.display = isSimpleBet ? 'block' : 'none';
    if (isRaceSelected && isSimpleBet) {
        renderDutchingOptimizer(state);
    } else if (!isRaceSelected && isSimpleBet) {
        DOM.distributionUI.innerHTML = `<p class="placeholder-text">Sélectionnez une course pour utiliser l'optimiseur.</p>`;
    }
}

function renderDutchingOptimizer(state) {
    if (!DOM.distributionUI) return;
    const { dutchingPrediction, participantsData } = state;
    let resultHTML = '';
    let applicationHTML = '';

    if (dutchingPrediction) {
        const { gainNet, decision } = dutchingPrediction;
        const isPositive = gainNet > 0;
        const gainColor = isPositive ? 'var(--success-color)' : 'var(--danger-color)';

        resultHTML = `
            <div class="dutching-result-card" style="border-left-color: ${gainColor};">
                <div class="dutching-decision">${escapeHTML(decision)}</div>
            </div>
        `;

        if (isPositive) {
            applicationHTML = renderDutchingApplication(state);
        }
    }

    DOM.distributionUI.innerHTML = `
        <div class="dutching-container">
            <div class="dutching-controls-compact">
                <select id="dutching-strategie-select" ${!participantsData ? 'disabled' : ''}>
                    <option value="2">2 Favoris</option>
                    <option value="3" selected>3 Favoris</option>
                    <option value="4">4 Favoris</option>
                </select>
                <button id="run-dutching-analysis-btn" type="button" ${!participantsData ? 'disabled' : ''}>
                    Analyser
                </button>
            </div>
            <div id="dutching-results-container">
                ${resultHTML}
            </div>
            <div id="dutching-application-ui">
                ${applicationHTML}
            </div>
        </div>
    `;
}

function renderDutchingApplication(state) {
    const { participantsData, bettingDistribution } = state;
    const { selectedHorses, mode, value, results: distResults } = bettingDistribution;
    
    if (!selectedHorses || selectedHorses.length === 0) return '';
    
    const numIndex = Object.fromEntries(participantsData.num.map((n, i) => [n, i]));
    
    const horsesHTML = selectedHorses.map(num => {
        const horse = {
            num,
            nom: participantsData.nom[numIndex[num]],
            cote: participantsData.cote[numIndex[num]]
        };
        return `<span class="horse-chip">${horse.num} (${horse.cote}/1)</span>`;
    }).join('');

    let resultsHTML = '';
    if (distResults) {
        if(distResults.error) {
            resultsHTML = `<p class="info-box non-partant">${escapeHTML(distResults.error)}</p>`;
        } else {
             resultsHTML = `
                <div class="distribution-results-summary">
                    <strong>Mise Totale : ${formatCurrency(distResults.totalMise)}</strong>
                </div>
                <table class="distribution-results-table">
                    <thead><tr><th>N°</th><th>Mise</th><th>Gain Net</th></tr></thead>
                    <tbody>
                        ${distResults.mises.sort((a,b) => a.num - b.num).map((m, index) => {
                            const horseName = participantsData.nom[numIndex[m.num]];
                            return `
                            <tr>
                                <td><strong>${m.num}</strong> ${escapeHTML(horseName)}</td>
                                <td>${formatCurrency(m.mise)}</td>
                                <td style="color: ${distResults.gainsNets[index] >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                                    ${formatCurrency(distResults.gainsNets[index])}
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>`;
        }
    }

    return `
        <div class="dutching-applier-container">
            <div class="horse-chips-container">${horsesHTML}</div>
            <div class="dutching-controls">
                <select id="distribution-mode-select">
                     <option value="targetProfitSimple" ${mode === 'targetProfitSimple' ? 'selected' : ''}>Bénéfice Visé</option>
                     <option value="totalBet" ${mode === 'totalBet' ? 'selected' : ''}>Mise Totale</option>
                </select>
                <input type="number" id="distribution-value-input" value="${value}" min="1">
                <button id="calculate-distribution-btn" type="button"><i class="fas fa-calculator"></i></button>
            </div>
            <div class="distribution-results-container">${resultsHTML}</div>
        </div>
    `;
}