// js/state.js
import { switchTab } from './ui.js';
import { handleLoadProgram, fetchParticipants, fetchDetailedPerformances } from './api.js';
import * as cache from './cache.js';
import { createGrilleFromParticipants, formatDate, calculateInfluenceScores } from './processing.js';

const initialState = {
    isLoading: false,
    status: { message: 'Veuillez sélectionner une date.', isError: false },
    isDailyAnalysisEnabled: false,
    selectedDate: null,
    selectedReunionNum: null,
    selectedCourseNum: null,
    programmeData: null,
    dailyAnalysisCache: null,
    participantsData: null,
    currentRaceDifficulty: null,
    currentRaceNote: '',
    filters: [],
    savedFilterSets: [],
    selectedFilterSetId: null,
    criteriaProfiles: [],
    activeCriteriaProfileId: null,
    bettingDistribution: {
        mode: 'totalBet',
        value: 10,
        selectedHorses: [],
        results: null
    },
    results: {
        combinations: [],
        betType: 3,
        betName: 'Tiercé',
        limitReached: false,
        showChampReduit: false
    },
    ui: {
        stats: {
            currentCriteria: 'cote',
            sortState: { by: 'num' },
            manualSelection: [],
            displayMode: 'value'
        },
        isCriteriaModalOpen: false,
        criteriaModal: {
            selectedProfileId: null,
            currentName: '',
            selectedKeys: new Set()
        }
    }
};
class StateManager {
    constructor() {
        this._state = { ...initialState };
        this._subscribers = [];
        this.filterWorker = null;
        if (window.Worker) {
            this.filterWorker = new Worker('js/worker.js', { type: 'module' });
            this.filterWorker.onmessage = (e) => this.setCalculationResult(e.data);
            this.filterWorker.onerror = (error) => {
                this.setState({
                    isLoading: false,
                    status: { message: `Erreur Worker : ${error.message}`, isError: true }
                });
            };
        }
    }
    async saveNoteForCurrentRace(note) {
        this.setState({ currentRaceNote: note });
        const { selectedDate, selectedReunionNum, selectedCourseNum } = this._state;
        if (!selectedDate || !selectedReunionNum || !selectedCourseNum) return;
        const dateStr = formatDate(new Date(selectedDate));
        const noteId = `${dateStr}-R${selectedReunionNum}-C${selectedCourseNum}`;
        await cache.set('raceNotes', { id: noteId, note: note });
    }
    exportStrategy() {
        const state = this._state;
        if (!state.participantsData) {
            this.setState({ status: { message: "Veuillez sélectionner une course avant d'exporter.", isError: true } });
            return;
        }
        const reunion = state.programmeData.programme.reunions.find(r => r.numOfficiel == state.selectedReunionNum);
        const course = reunion.courses.find(c => c.numExterne == state.selectedCourseNum);
        const strategyData = {
            race: {
                date: state.selectedDate,
                reunionNum: state.selectedReunionNum,
                courseNum: state.selectedCourseNum,
                name: course.libelle,
                discipline: course.discipline,
                distance: course.distance,
                partants: course.nombrePartants
            },
            note: state.currentRaceNote,
            filters: state.filters
        };
        const dataStr = JSON.stringify(strategyData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `strategie_${state.selectedDate}_R${state.selectedReunionNum}C${state.selectedCourseNum}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.setState({ status: { message: "Stratégie exportée." } });
    }
    async importStrategy(file) {
        if (!file) return;
        const text = await file.text();
        try {
            const data = JSON.parse(text);
            if (!data.race || !data.race.date || !data.race.reunionNum || !data.race.courseNum || !data.filters) {
                throw new Error("Fichier de stratégie invalide.");
            }
            this.setState({ status: { message: "Importation de la stratégie..." } });
            document.getElementById('dateInput').value = data.race.date;
            await this.changeDate(data.race.date);
            await this.selectReunion(data.race.reunionNum, data.race.courseNum);
            this.setState({
                filters: data.filters,
                currentRaceNote: data.note || ''
            });
            this.setState({ status: { message: "Stratégie importée avec succès." } });
            switchTab('strategie');
        } catch (error) {
            this.setState({ status: { message: `Erreur d'importation : ${error.message}`, isError: true } });
        }
    }
    loadCriteriaProfiles() {
        const savedProfilesJSON = localStorage.getItem('pmuCriteriaProfiles');
        let profiles = [];
        if (savedProfilesJSON) {
            try {
                const parsedProfiles = JSON.parse(savedProfilesJSON);
                if (Array.isArray(parsedProfiles) && parsedProfiles.length > 0) {
                    profiles = parsedProfiles;
                }
            } catch (e) {
                console.error("Erreur lors du chargement des profils, réinitialisation.", e);
            }
        }
        if (profiles.length === 0) {
            profiles = [{
                id: 'default',
                name: 'Défaut',
                isDefault: true,
                criteriaKeys: ['cote', 'dernierePerfNorm', 'ecartDistance', 'nbPlaces_3d', 'meilleurePerfAbsolue_5d', 'poids', 'valeur', 'age', 'sexe', 'gainsCarriere', 'ecartJours', 'reussiteHippo', 'reussiteDistance']
            }];
            localStorage.setItem('pmuCriteriaProfiles', JSON.stringify(profiles));
        }
        this.setState({ criteriaProfiles: profiles });
    }
    _saveCriteriaProfiles() {
        localStorage.setItem('pmuCriteriaProfiles', JSON.stringify(this._state.criteriaProfiles));
    }
     openCriteriaModal() {
        const activeProfile = this._state.criteriaProfiles.find(p => p.id === this._state.activeCriteriaProfileId) || this._state.criteriaProfiles[0];
        this.setState({
            ui: {
                ...this._state.ui,
                isCriteriaModalOpen: true,
                criteriaModal: {
                    selectedProfileId: activeProfile.id,
                    currentName: activeProfile.name,
                    // On s'assure que c'est bien un tableau, mais sans conversion inutile si c'en est déjà un
                    selectedKeys: Array.isArray(activeProfile.criteriaKeys) ? [...activeProfile.criteriaKeys] : []
                }
            }
        });
    }
    closeCriteriaModal() {
        this.setState({ ui: { ...this._state.ui, isCriteriaModalOpen: false } });
    }
    updateCriteriaModal(newState) {
        this.setState({ ui: { ...this._state.ui, criteriaModal: { ...this._state.ui.criteriaModal, ...newState } } });
    }
    selectProfileInModal(profileId) {
        const selectedProfile = this._state.criteriaProfiles.find(p => p.id === profileId);
        if (selectedProfile) {
            this.updateCriteriaModal({
                selectedProfileId: profileId,
                currentName: selectedProfile.name,
                selectedKeys: Array.from(selectedProfile.criteriaKeys)
            });
        }
    }
    saveCriteriaProfile() {
        const { selectedProfileId, currentName, selectedKeys } = this._state.ui.criteriaModal;
        if (!currentName.trim()) {
            this.setState({ status: { message: "Le nom du profil ne peut être vide.", isError: true } });
            return;
        }
        const profiles = [...this._state.criteriaProfiles];
        const existingProfile = profiles.find(p => p.id === selectedProfileId);
        if (existingProfile && !existingProfile.isDefault) {
            // Mise à jour
            existingProfile.name = currentName;
            existingProfile.criteriaKeys = selectedKeys; // C'est déjà un Array
        } else {
            // Création
            const newProfile = {
                id: Date.now().toString(),
                name: currentName,
                criteriaKeys: selectedKeys // C'est déjà un Array
            };
            profiles.push(newProfile);
            this.updateCriteriaModal({ selectedProfileId: newProfile.id });
        }
        this.setState({ criteriaProfiles: profiles, status: { message: `Profil "${currentName}" sauvegardé.` } });
        this._saveCriteriaProfiles();
    }
    deleteCriteriaProfile() {
        const { selectedProfileId } = this._state.ui.criteriaModal;
        const profileToDelete = this._state.criteriaProfiles.find(p => p.id === selectedProfileId);
        if (!profileToDelete || profileToDelete.isDefault) {
            this.setState({ status: { message: "Impossible de supprimer ce profil.", isError: true } });
            return;
        }
        if (!confirm(`Voulez-vous vraiment supprimer le profil "${profileToDelete.name}" ?`)) return;
        const newProfiles = this._state.criteriaProfiles.filter(p => p.id !== selectedProfileId);
        this.setState({ criteriaProfiles: newProfiles });
        this._saveCriteriaProfiles();
        this.selectProfileInModal(newProfiles[0].id);
    }
    applyCriteriaProfile() {
        const { selectedProfileId } = this._state.ui.criteriaModal;
        this.setState({ activeCriteriaProfileId: selectedProfileId });
        this.closeCriteriaModal();
    }
    subscribe(callback) {
        this._subscribers.push(callback);
    }
    setState(newState) {
        this._state = { ...this._state, ...newState };
        this._subscribers.forEach(callback => callback(this._state));
        this.saveAppState();
    }
    getState() {
        return this._state;
    }
    saveAppState() {
        if (this._state.isLoading) return;
        const stateToSave = {
            date: this._state.selectedDate,
            reunionNum: this._state.selectedReunionNum,
            courseNum: this._state.selectedCourseNum,
            filters: this._state.filters,
            betType: this._state.results.betType,
            showChampReduit: this._state.results.showChampReduit,
            activeCriteriaProfileId: this._state.activeCriteriaProfileId,
            isDailyAnalysisEnabled: this._state.isDailyAnalysisEnabled
        };
        localStorage.setItem('pmuAppState', JSON.stringify(stateToSave));
    }
    async initialize() {
        await this.loadFilterSets();
        this.loadCriteriaProfiles(); 

        const savedStateJSON = localStorage.getItem('pmuAppState');
        let stateToLoad = null;
        let dateToLoad = new Date();
        
        let finalProfileId = this.getState().criteriaProfiles[0]?.id || null;

        if (savedStateJSON) {
            const savedState = JSON.parse(savedStateJSON);
            stateToLoad = savedState;

            if (savedState.date) {
                dateToLoad = new Date(savedState.date + 'T00:00:00');
            }

            const savedProfileId = savedState.activeCriteriaProfileId;
            if (this.getState().criteriaProfiles.some(p => p.id === savedProfileId)) {
                finalProfileId = savedProfileId;
            }

            this.setState({
                filters: savedState.filters || [],
                results: {
                    ...this._state.results,
                    betType: savedState.betType || 3,
                    showChampReduit: savedState.showChampReduit || false
                },
                isDailyAnalysisEnabled: savedState.isDailyAnalysisEnabled === true
            });
        }
        
        this.setState({ activeCriteriaProfileId: finalProfileId });

        const checkbox = document.getElementById('toggleDailyAnalysis');
        if (checkbox) checkbox.checked = this._state.isDailyAnalysisEnabled;
        
        const dateStr = dateToLoad.toISOString().split('T')[0];
        document.getElementById('dateInput').value = dateStr;
        await this.changeDate(dateStr, stateToLoad);
    }
    async getDailyAnalysis(date, programme) {
        this.setState({ status: { message: "Analyse de la journée en cours...", isError: false } });
        const dateStr = formatDate(date);
        const allParticipantPromises = [];
        programme.reunions.forEach(reunion => {
            reunion.courses.forEach(course => {
                const reunionId = `R${reunion.numOfficiel}`;
                const courseId = `C${course.numExterne}`;
                allParticipantPromises.push(
                    fetchParticipants(dateStr, reunionId, courseId).then(p => p?.participants || [])
                );
            });
        });
        try {
            const allRacesParticipants = await Promise.all(allParticipantPromises);
            const influenceScores = calculateInfluenceScores(allRacesParticipants);
            this.setState({
                status: { message: "Analyse de la journée terminée.", isError: false },
                dailyAnalysisCache: { influenceScores }
            });
            return { influenceScores };
        } catch (error) {
            console.error("Erreur lors de l'analyse de la journée:", error);
            this.setState({ status: { message: "Erreur lors de l'analyse.", isError: true } });
            return null;
        }
    }
    async changeDate(dateStr, stateToLoad = null) {
        this.setState({
            isLoading: true,
            status: { message: 'Chargement du programme...' },
            selectedDate: dateStr,
            programmeData: null,
            participantsData: null,
            dailyAnalysisCache: null,
            selectedReunionNum: null,
            selectedCourseNum: null
        });
        const date = new Date(dateStr + 'T00:00:00');
        const programmeKey = `programme-${formatDate(date)}`;
        const cachedProgramme = await cache.get('apiResponses', programmeKey);
        if (cachedProgramme) {
            this.setState({
                programmeData: cachedProgramme,
                status: { message: 'Programme chargé depuis le cache.' }
            });
        }
        const freshProgramme = await handleLoadProgram(date);
        if (freshProgramme) {
            this.setState({ programmeData: freshProgramme, status: { message: 'Programme mis à jour.' } });
            await cache.set('apiResponses', { key: programmeKey, data: freshProgramme });
        }
        const programmeToUse = this.getState().programmeData;
        if (programmeToUse && programmeToUse.programme) {
            if (this._state.isDailyAnalysisEnabled) {
                console.log("Calcul des influences activé. Lancement de l'analyse.");
                await this.getDailyAnalysis(date, programmeToUse.programme);
            } else {
                console.log("Calcul des influences désactivé. Nettoyage du cache d'analyse.");
                this.setState({ dailyAnalysisCache: null });
            }
            if (stateToLoad && stateToLoad.reunionNum) {
                await this.selectReunion(stateToLoad.reunionNum, stateToLoad.courseNum);
            } else {
                let quinteCourse = null;
                let quinteReunion = null;
                for (const reunion of programmeToUse.programme.reunions) {
                    const course = reunion.courses.find(c => c.paris?.some(p => p.typePari === 'QUINTE_PLUS'));
                    if (course) {
                        quinteCourse = course;
                        quinteReunion = reunion;
                        break;
                    }
                }
                if (quinteReunion && quinteCourse) {
                    this.setState({ status: { message: 'Course Quinté+ détectée, chargement...' } });
                    await this.selectReunion(quinteReunion.numOfficiel, quinteCourse.numExterne);
                }
            }
        }
        this.setState({ isLoading: false });
    }
        async selectReunion(reunionNum, courseToSelect = null) {
        this.setState({
            selectedReunionNum: reunionNum,
            selectedCourseNum: null,
            participantsData: null,
            currentRaceDifficulty: null
        });
        if (courseToSelect) {
            await this.selectCourse(courseToSelect);
        }
    }
        async selectCourse(courseNum) {
        this.setState({
            isLoading: true,
            selectedCourseNum: courseNum,
            participantsData: null,
            currentRaceDifficulty: null,
            currentRaceNote: '',
            bettingDistribution: initialState.bettingDistribution,
            ui: { ...this._state.ui, stats: { ...initialState.ui.stats, manualSelection: [] } }
        });

        const { programmeData, selectedDate, selectedReunionNum } = this._state;
        const date = new Date(selectedDate);
        const dateStr = formatDate(date);
        const noteId = `${dateStr}-R${selectedReunionNum}-C${courseNum}`;
        const reunionId = `R${selectedReunionNum}`;
        const courseId = `C${courseNum}`;
        const participantsKey = `participants-${dateStr}-${reunionId}-${courseId}`;
        const performancesKey = `performances-${dateStr}-${reunionId}-${courseId}`;
        
        const savedNote = await cache.get('raceNotes', noteId);
        if (savedNote) {
            this.setState({ currentRaceNote: savedNote.note });
        }

        const [cachedParticipants, cachedPerformances] = await Promise.all([
            cache.get('apiResponses', participantsKey),
            cache.get('apiResponses', performancesKey)
        ]);

        if (cachedParticipants) {
            const participantsData = this.processParticipantsData(cachedParticipants, cachedPerformances);
            this.setState({
                participantsData: participantsData,
                currentRaceDifficulty: participantsData.difficultyIndex,
                status: { message: 'Partants chargés du cache.' }
            });
        }

        const [freshParticipants, freshPerformances] = await Promise.all([
            fetchParticipants(dateStr, reunionId, courseId),
            fetchDetailedPerformances(dateStr, reunionId, courseId)
        ]);

        if (freshParticipants) {
            await cache.set('apiResponses', { key: participantsKey, data: freshParticipants });
            if (freshPerformances) {
                await cache.set('apiResponses', { key: performancesKey, data: freshPerformances });
            }
            const participantsData = this.processParticipantsData(freshParticipants, freshPerformances);
            this.setState({
                participantsData: participantsData,
                currentRaceDifficulty: participantsData.difficultyIndex,
                status: { message: 'Données de la course mises à jour.' }
            });
        }
        
        this.setState({ isLoading: false });
    }

    processParticipantsData(participantsJson, performancesJson) {
        if (!participantsJson) return null;
        const { programmeData, dailyAnalysisCache, selectedReunionNum, selectedCourseNum } = this._state;
        
        if (this._state.isDailyAnalysisEnabled && (!dailyAnalysisCache || !dailyAnalysisCache.influenceScores)) {
            console.error("dailyAnalysisCache.influenceScores n'est pas disponible. La grille sera incomplète.");
        }
        const selectedReunionData = programmeData.programme.reunions.find(r => r.numOfficiel == selectedReunionNum);
        const selectedCourseData = selectedReunionData.courses.find(c => c.numExterne == selectedCourseNum);
        const courseContext = {
            reunionDate: selectedReunionData.dateReunion,
            discipline: selectedCourseData.specialite || selectedCourseData.discipline || '',
            distance: selectedCourseData.distance,
            hippodrome: selectedReunionData.hippodrome.libelleCourt,
            nbParticipants: participantsJson.participants.length
        };
        return createGrilleFromParticipants(
            participantsJson,
            performancesJson,
            dailyAnalysisCache ? dailyAnalysisCache.influenceScores : null,
            courseContext
        );
    }
    addFilter(filter) {
        const newFilters = [filter, ...this._state.filters];
        this.setState({ filters: newFilters });
    }
    updateFilter(index, field, value) {
        const newFilters = [...this._state.filters];
        if (newFilters[index]) {
            newFilters[index][field] = value;
            if (field === 'column' && newFilters[index].name === 'COMB') {
                newFilters[index].value = '';
            }
            this.setState({ filters: newFilters });
        }
    }
    deleteFilter(index) {
        const newFilters = this._state.filters.filter((_, i) => i !== index);
        this.setState({ filters: newFilters });
    }
    toggleFilterCollapsed(index) {
        const newFilters = [...this._state.filters];
        if (newFilters[index]) {
            newFilters[index].isCollapsed = !newFilters[index].isCollapsed;
            this.setState({ filters: newFilters });
        }
    }
    async loadFilterSets() {
        const filterSets = await cache.getAll('filterSets');
        this.setState({ savedFilterSets: filterSets || [] });
    }
    async saveCurrentFilterSet(name) {
        if (!name || !name.trim()) {
            this.setState({ status: { message: "Le nom ne peut pas être vide.", isError: true } });
            return;
        }
        if (this._state.filters.length === 0) {
            this.setState({ status: { message: "Aucun filtre à sauvegarder.", isError: true } });
            return;
        }
        const newSet = {
            id: Date.now().toString(),
            name: name.trim(),
            filters: JSON.parse(JSON.stringify(this._state.filters))
        };
        await cache.set('filterSets', newSet);
        const updatedSets = [...this._state.savedFilterSets, newSet];
        this.setState({
            savedFilterSets: updatedSets,
            selectedFilterSetId: newSet.id,
            status: { message: `Ensemble "${name}" sauvegardé.` }
        });
    }
    applyFilterSet(id) {
        if (!id) {
            this.setState({ filters: [], selectedFilterSetId: null });
            return;
        }
        const setToApply = this._state.savedFilterSets.find(s => s.id === id);
        if (setToApply) {
            const newFilters = JSON.parse(JSON.stringify(setToApply.filters));
            this.setState({
                filters: newFilters,
                selectedFilterSetId: id,
                status: { message: `Ensemble "${setToApply.name}" appliqué.` }
            });
        }
    }
    async deleteFilterSet(id) {
        if (!id) return;
        const setToDelete = this._state.savedFilterSets.find(s => s.id === id);
        if (!setToDelete) return;
        if (!confirm(`Voulez-vous vraiment supprimer l'ensemble "${setToDelete.name}" ?`)) {
            return;
        }
        await cache.deleteItem('filterSets', id);
        const updatedSets = this._state.savedFilterSets.filter(s => s.id !== id);
        this.setState({
            savedFilterSets: updatedSets,
            selectedFilterSetId: this._state.selectedFilterSetId === id ? null : this._state.selectedFilterSetId,
            status: { message: `Ensemble "${setToDelete.name}" supprimé.` }
        });
    }
    runCalculation(betType, betName, limit) {
        if (!this._state.participantsData || !this.filterWorker) return;
        this.setState({
            isLoading: true,
            status: { message: 'Calcul déporté en arrière-plan...' },
            results: { ...this._state.results, betType, betName }
        });
        this.filterWorker.postMessage({
            grille: this._state.participantsData,
            functions: this._state.filters,
            betType: betType,
            limit: limit
        });
    }
    setCalculationResult(data) {
        if (data.status === 'success') {
            const { combinations, limitReached } = data;
            const newResults = { ...this._state.results, combinations, limitReached };
            let statusMessage = `Calcul terminé. ${combinations.length} combinaisons trouvées.`;
            if (limitReached) statusMessage += " La limite a été atteinte.";
            this.setState({
                isLoading: false,
                results: newResults,
                status: { message: statusMessage }
            });
            if (combinations.length > 0) {
                switchTab('results');
            }
        } else {
            this.setState({
                isLoading: false,
                status: { message: `Erreur de calcul : ${data.message}`, isError: true }
            });
        }
    }
    updateStatsUI(newStatsState) {
        this.setState({ ui: { ...this._state.ui, stats: { ...this._state.ui.stats, ...newStatsState } } });
    }
    toggleChampReduit(isChecked) {
        this.setState({ results: { ...this._state.results, showChampReduit: isChecked } });
    }

    updateBettingDistribution(newState) {
        this.setState({
            bettingDistribution: {
                ...this._state.bettingDistribution,
                ...newState,
                results: null
            }
        });
    }

    calculateBettingDistribution() {
        const { participantsData, bettingDistribution } = this._state;
        const { mode, value, selectedHorses } = bettingDistribution;

        if (!participantsData || selectedHorses.length === 0) {
            this.setState({ status: { message: "Veuillez sélectionner au moins un cheval.", isError: true } });
            return;
        }
        
        const numIndex = Object.fromEntries(participantsData.num.map((n, i) => [n, i]));

        const selection = selectedHorses
            .map(num => ({
                num,
                cote: participantsData.cote[numIndex[num]]
            }))
            .filter(h => h.cote && h.cote > 1 && participantsData.statut[numIndex[h.num]] === 'PARTANT');

        if (selection.length === 0) {
            this.setState({ status: { message: "Aucun cheval sélectionné avec une cote valide.", isError: true } });
            return;
        }

        let mises = [];
        let totalMise = 0;
        let error = null;

        if (mode === 'totalBet') {
            const miseTotale = value;
            const inverseSum = selection.reduce((sum, h) => sum + (1 / h.cote), 0);
            if (inverseSum > 0) {
                mises = selection.map(h => ({ num: h.num, cote: h.cote, mise: parseFloat(((miseTotale * (1 / h.cote)) / inverseSum).toFixed(2)) }));
                totalMise = mises.reduce((sum, m) => sum + m.mise, 0);
            }
        } else { // 'targetProfitSimple' or 'targetProfitExact'
            const beneficeVise = value;
            if (mode === 'targetProfitSimple') {
                mises = selection.map(h => {
                    const mise = Math.ceil(beneficeVise / (h.cote - 1));
                    return { num: h.num, cote: h.cote, mise };
                });
            } else { // 'targetProfitExact'
                const sumInverseCotes = selection.reduce((sum, h) => sum + (1 / h.cote), 0);
                if (sumInverseCotes >= 1) {
                    error = "Impossible de garantir un bénéfice avec ces cotes (somme des inverses >= 1).";
                } else {
                    const gainCible = beneficeVise / (1 - sumInverseCotes);
                    mises = selection.map(h => {
                        const mise = Math.ceil(gainCible / h.cote);
                        return { num: h.num, cote: h.cote, mise };
                    });
                }
            }
            if(!error) totalMise = mises.reduce((sum, m) => sum + m.mise, 0);
        }

        if (error) {
             this.setState({
                status: { message: error, isError: true },
                bettingDistribution: { ...bettingDistribution, results: { error } }
             });
        } else {
            const results = {
                mises,
                totalMise,
                gainsBruts: mises.map(m => parseFloat((m.mise * m.cote).toFixed(2))),
                gainsNets: mises.map(m => parseFloat(((m.mise * m.cote) - totalMise).toFixed(2)))
            };
            this.setState({
                status: { message: `Calcul de répartition terminé. Mise totale: ${totalMise.toFixed(2)}€` },
                bettingDistribution: { ...bettingDistribution, results }
            });
        }
    }
}
export const stateManager = new StateManager();