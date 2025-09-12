// js/processing.js

export function formatDate(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}${month}${year}`;
}

export function calculateInfluenceScores(allRacesParticipants) {
    const influence = {
        jockey: {},
        entraineur: {},
        pere: {},
        mere: {}
    };
    const allParticipants = allRacesParticipants.flat();
    allParticipants.forEach(p => {
        if (p.driver) influence.jockey[p.driver] = (influence.jockey[p.driver] || 0) + 1;
        if (p.entraineur) influence.entraineur[p.entraineur] = (influence.entraineur[p.entraineur] || 0) + 1;
        if (p.nomPere) influence.pere[p.nomPere] = (influence.pere[p.nomPere] || 0) + 1;
        if (p.nomMere) influence.mere[p.nomMere] = (influence.mere[p.nomMere] || 0) + 1;
    });
    return influence;
}

function getRanks(array, direction = 'asc') {
    const indexedArray = array.map((value, index) => ({ value, index }));
    const numericArray = indexedArray.filter(item => typeof item.value === 'number' && !isNaN(item.value));
    numericArray.sort((a, b) => direction === 'asc' ? a.value - b.value : b.value - a.value);
    const ranks = new Array(array.length).fill(null);
    if (numericArray.length === 0) return ranks;
    let currentRank = 1;
    for (let i = 0; i < numericArray.length; i++) {
        if (i > 0 && numericArray[i].value !== numericArray[i - 1].value) {
            currentRank = i + 1;
        }
        ranks[numericArray[i].index] = currentRank;
    }
    return ranks;
}

function normalizePerf(perfChar) {
    const place = parseInt(perfChar, 10);
    if (!isNaN(place)) {
        return place === 0 ? 9 : Math.min(place, 9);
    }
    return 9;
}

function analyzeMusique(musiqueString, discipline) {
    if (!musiqueString || typeof musiqueString !== 'string') {
        return { nbCoursesAnnee: 0, dernierePerfNorm: null, evolPerf: null, moyennePerfAnnee: null, indiceForme: 10 };
    }

    // On prend tout ce qui est avant la première parenthèse pour avoir les perfs les plus récentes.
    let musiqueAParser = musiqueString;
    const firstParenIndex = musiqueString.indexOf('(');
    if (firstParenIndex !== -1) {
        musiqueAParser = musiqueString.substring(0, firstParenIndex);
    }
    
    const perfs = [];
    const regex = /(\d+|[A-Z])([a-z])?/g;
    let match;
    while ((match = regex.exec(musiqueAParser)) !== null) {
        perfs.push(match[1]);
    }

    const nbCoursesAnnee = perfs.length;

    if (nbCoursesAnnee === 0) {
        return { nbCoursesAnnee: 0, dernierePerfNorm: null, evolPerf: null, moyennePerfAnnee: null, indiceForme: 10 };
    }

    const dernierePerfNorm = normalizePerf(perfs[0]);
    const evolPerf = perfs.length > 1 ? normalizePerf(perfs[1]) - normalizePerf(perfs[0]) : null;

    const normalizedPerfs = perfs.map(p => {
        const place = parseInt(p, 10);
        if (!isNaN(place)) {
            if (place === 0) return 9;
            return Math.min(place, 11);
        }
        if (['D', 'R'].includes(p)) return 6;
        if (['A', 'T'].includes(p)) return 11;
        return 11;
    });

    const sumPerfs = normalizedPerfs.reduce((sum, p) => sum + p, 0);
    const moyennePerfAnnee = parseFloat((sumPerfs / nbCoursesAnnee).toFixed(2));
    
    const perfsPourIndice = normalizedPerfs.slice(0, 5);
    const sumIndice = perfsPourIndice.reduce((a, b) => a + b, 0);
    const indiceForme = parseFloat((sumIndice / perfsPourIndice.length).toFixed(2));

    return { nbCoursesAnnee, dernierePerfNorm, evolPerf, moyennePerfAnnee, indiceForme };
}

// --- SIGNATURE DE FONCTION MODIFIÉE ---
export function createGrilleFromParticipants(participantsJson, performancesJson, influenceScores, courseContext) {
    if (!participantsJson || !participantsJson.participants || participantsJson.participants.length === 0) return null;
    
    const { discipline, distance: currentDistance, hippodrome: currentHippodrome, nbParticipants: currentNbParticipants } = courseContext;
    const safeInfluenceScores = influenceScores || { jockey: {}, entraineur: {}, pere: {}, mere: {} };

    const perfMap = new Map();
    if (performancesJson && performancesJson.participants) {
        performancesJson.participants.forEach(p => {
            const dernieresPerformances = p.coursesCourues.map(course => {
                const ourPerf = course.participants.find(part => part.itsHim === true);
                if (!ourPerf) return null;
                
                const hippodromeName = course.hippodrome?.libelleCourt || course.hippodrome;

                return {
                    date: course.date,
                    place: ourPerf.place?.place,
                    distance: course.distance,
                    hippodrome: { libelleCourt: hippodromeName },
                    reductionKm: ourPerf.reductionKilometrique,
                    tempsObtenu: ourPerf.tempsObtenu,
                    nombreParticipants: course.nbParticipants,
                    poids: ourPerf.poidsJockey,
                    allocation: course.allocation
                };
            }).filter(Boolean);

            perfMap.set(p.numPmu, { dernieresPerformances });
        });
    }

        const grille = {
        discipline: discipline,
        num: [], nom: [], age: [], sexe: [], poids: [], corde: [], valeur: [], cote: [],
        def: [], musique: [], statut: [], nomPere: [], nomMere: [],
        indiceForme: [], gainsParCourse: [], coursesApresAbsence: [], chevauxBattus3d: [],
        chevauxBattus3dPct: [], unite: [], parite: [],
        gainsCarriere: [], gainsAnneeEnCours: [], gainsAnneePrecedente: [],
        gainsVictoires: [], gainsPlace: [],
        sum_allocations_3d: [], ecartPoids: [],
        lettre_1: [], lettre_2: [], ecartJours: [],
        driverChange: [], oeilleres: [],
        reussiteHippo: [], reussiteDistance: [],
        nbCoursesAnnee: [], nbCoursesCarriere: [], dernierePerfNorm: [], evolPerf: [], moyennePerfAnnee: [],
        influenceJockey: [], influenceEntraineur: [], influencePere: [],
        dernierReducKm: [], recordVitesseHippo: [], rkAdjusted: [],
        recordVitessePlatHippo: [],
        dernierMemeHippo: [], dernierNbPartants: [],
        formeMontante: [], nbPlaces_3d: [], meilleurePerfAbsolue_5d: [],
        ecartDistance: [],
        nbCoursesHippo: [],
        arrivalRanks: {}
    };

    participantsJson.participants.forEach(p => {
        try {
            const perf = perfMap.get(p.numPmu);
            const musiqueAnalysis = analyzeMusique(p.musique, discipline);
            grille.indiceForme.push(musiqueAnalysis.indiceForme);
            grille.num.push(p.numPmu);
            grille.nom.push(p.nom || '');
            grille.statut.push(p.statut || 'INCONNU');
            grille.age.push(p.age || null);
            grille.sexe.push(p.sexe?.charAt(0) || 'N');
            const weightValue = p.handicapPoids || p.poidsCondition?.poids || p.poidsConditionMonte;
            grille.poids.push(weightValue ? weightValue / 10 : null);
            grille.corde.push(p.placeCorde || null);
            grille.valeur.push(p.handicapValeur || null);
            grille.cote.push(p.dernierRapportDirect?.rapport || null);
            grille.musique.push(p.musique || '-');
	    grille.def.push((p.deferre || '').includes('DEFERRE') ? 1 : 0);
            grille.driverChange.push(p.driverChange ? 1 : 0);
            grille.oeilleres.push(p.oeilleres?.code || 'NON');
            grille.gainsCarriere.push(p.gainsParticipant?.gainsCarriere || 0);            
            grille.gainsAnneeEnCours.push(p.gainsParticipant?.gainsAnneeEnCours || 0);
            grille.gainsAnneePrecedente.push(p.gainsParticipant?.gainsAnneePrecedente || 0);
            grille.gainsVictoires.push(p.gainsParticipant?.gainsVictoires || 0);
            grille.gainsPlace.push(p.gainsParticipant?.gainsPlace || 0);
            grille.lettre_1.push(p.nom?.charAt(0).toUpperCase() || '');
            grille.lettre_2.push(p.nom?.length > 1 ? p.nom.charAt(1).toUpperCase() : '');
            grille.nomPere.push(p.nomPere || 'N/A');
            grille.nomMere.push(p.nomMere || 'N/A');
            grille.nbCoursesAnnee.push(musiqueAnalysis.nbCoursesAnnee);
            grille.nbCoursesCarriere.push(p.nombreCourses || 0);
            grille.dernierePerfNorm.push(musiqueAnalysis.dernierePerfNorm);
            grille.evolPerf.push(musiqueAnalysis.evolPerf);
            grille.moyennePerfAnnee.push(musiqueAnalysis.moyennePerfAnnee);
            grille.influenceJockey.push(safeInfluenceScores.jockey[p.driver] || 0);
            grille.influenceEntraineur.push(safeInfluenceScores.entraineur[p.entraineur] || 0);
            grille.influencePere.push(safeInfluenceScores.pere[p.nomPere] || 0);
            
            const gains = p.gainsParticipant?.gainsCarriere || 0;
            const nbCourses = p.nombreCourses || 0;
            grille.gainsParCourse.push(nbCourses > 0 ? Math.round(gains / nbCourses) : null);
            
            grille.unite.push(p.numPmu <= 9 ? 1 : 0);
            grille.parite.push(p.numPmu % 2 === 0 ? 1 : 0);

            if (p.ordreArrivee > 0) {
                grille.arrivalRanks[p.numPmu] = p.ordreArrivee;
            }
            if (perf && perf.dernieresPerformances && perf.dernieresPerformances.length > 0) {
                const lastPerf = perf.dernieresPerformances[0];
                const distDuJour = p.handicapDistance; // On utilise la distance du jour du cheval
                
                let joursEcart = p.nombreJoursDerniereCourse;
                if (joursEcart === undefined && lastPerf.date && courseContext.reunionDate) {
                    const diffMs = courseContext.reunionDate - lastPerf.date;
                    joursEcart = Math.round(diffMs / (1000 * 60 * 60 * 24));
                }
                grille.ecartJours.push(joursEcart ?? null);

                grille.dernierNbPartants.push(lastPerf.nombreParticipants || null);
                const last3Perfs = perf.dernieresPerformances.slice(0, 3);
                grille.sum_allocations_3d.push(last3Perfs.reduce((sum, perfItem) => sum + (perfItem.allocation || 0), 0));
                const lastPerfWithWeight = perf.dernieresPerformances.find(pf => pf.poids !== null);
                const currentWeight = grille.poids[grille.poids.length - 1];
                grille.ecartPoids.push(lastPerfWithWeight && currentWeight !== null ? currentWeight - lastPerfWithWeight.poids : null);
                
                const finishedPerfs = perf.dernieresPerformances.filter(dp => typeof dp.place === 'number' && dp.place > 0);

                grille.formeMontante.push(finishedPerfs.length >= 2 ? (finishedPerfs[0].place < finishedPerfs[1].place ? 1 : 0) : null);                grille.nbPlaces_3d.push(finishedPerfs.slice(0, 3).filter(dp => dp.place <= 3).length);
                const places5d = finishedPerfs.slice(0, 5).map(dp => dp.place);
                grille.meilleurePerfAbsolue_5d.push(places5d.length > 0 ? Math.min(...places5d) : null);
                const currentHippoUpper = currentHippodrome?.trim().toUpperCase();
                const perfsOnHippo = perf.dernieresPerformances.filter(dp => dp.hippodrome?.libelleCourt?.trim().toUpperCase() === currentHippoUpper);
                grille.dernierMemeHippo.push(perfsOnHippo.length > 0 ? 1 : 0);
                grille.nbCoursesHippo.push(perfsOnHippo.length);
                grille.ecartDistance.push(lastPerf.distance ? (distDuJour - lastPerf.distance) : null);

                if (discipline.startsWith('TROT_')) {
                    let formattedReduc = null;
                    if (lastPerf.reductionKm && lastPerf.distance) {
                        const distanceKm = (lastPerf.distance / 1000).toFixed(1).replace('.', ',');
                        formattedReduc = `${lastPerf.reductionKm}-${distanceKm}km`;
                    }
                    grille.dernierReducKm.push(formattedReduc);
                    
                    const perfsOnHippoWithRK = perfsOnHippo.filter(dp => typeof dp.reductionKm === 'number' && dp.reductionKm > 0);
                    grille.recordVitesseHippo.push(perfsOnHippoWithRK.length > 0 ? Math.min(...perfsOnHippoWithRK.map(dp => dp.reductionKm)) : null);
                    const allPerfsWithRK = perf.dernieresPerformances.filter(dp => typeof dp.reductionKm === 'number' && dp.reductionKm > 0);
                    if (allPerfsWithRK.length > 0) {
                        const bestPerfWithRK = allPerfsWithRK.reduce((best, current) => current.reductionKm < best.reductionKm ? current : best);
                        const distanceOfBestRK = bestPerfWithRK.distance;
                        const distanceCoeff = 1 + ((distDuJour - distanceOfBestRK) / distDuJour) * 0.1;
                        grille.rkAdjusted.push(Math.round(bestPerfWithRK.reductionKm * distanceCoeff));
                    } else {
                        grille.rkAdjusted.push(null);
                    }
                    grille.recordVitessePlatHippo.push(null);
                } else {
                    grille.dernierReducKm.push(null);
                    grille.recordVitesseHippo.push(null);
                    grille.rkAdjusted.push(null);
                    const perfsOnHippoWithTime = perfsOnHippo.filter(dp => typeof dp.tempsDuPremier === 'number' && dp.tempsDuPremier > 0 && typeof dp.distance === 'number' && dp.distance > 0);
                    const speedsOnHippo = perfsOnHippoWithTime.map(dp => dp.distance / (dp.tempsDuPremier / 100));
                    grille.recordVitessePlatHippo.push(speedsOnHippo.length > 0 ? parseFloat(Math.max(...speedsOnHippo).toFixed(2)) : null);
                }

                let hippoSuccess = 0, hippoTotal = 0, distSuccess = 0, distTotal = 0;
                finishedPerfs.forEach(dp => {
                    const distCourseJour = p.handicapDistance;
                    if (dp.hippodrome?.libelleCourt?.trim().toUpperCase() === currentHippoUpper) {
                        hippoTotal++;
                        if (dp.place <= 3) hippoSuccess++;
                    }
                    if (Math.abs(dp.distance - distCourseJour) <= 200) {
                        distTotal++;
                        if (dp.place <= 3) distSuccess++;
                    }
                });
                grille.reussiteHippo.push(hippoTotal > 0 ? parseFloat(((hippoSuccess / hippoTotal) * 100).toFixed(1)) : 0);
                grille.reussiteDistance.push(distTotal > 0 ? parseFloat(((distSuccess / distTotal) * 100).toFixed(1)) : 0);

                const last3PerfsWithData = finishedPerfs.slice(0, 3);
                const chevauxBattus = last3PerfsWithData.reduce((total, dp) => total + ((dp.nombreParticipants || 0) - dp.place), 0);
                const totalPartantsAffrontes = last3PerfsWithData.reduce((total, dp) => total + (dp.nombreParticipants || 0), 0);
                
                grille.chevauxBattus3d.push(chevauxBattus > 0 ? chevauxBattus : null);
                grille.chevauxBattus3dPct.push(totalPartantsAffrontes > 0 ? Math.round((chevauxBattus / totalPartantsAffrontes) * 100) : null);

                let coursesDepuisAbsence = null;
                if (perf.dernieresPerformances.length > 1) {
                    const indexAbsence = perf.dernieresPerformances.findIndex((dp, index) => {
                        if (index + 1 >= perf.dernieresPerformances.length) return false;
                        const nextPerf = perf.dernieresPerformances[index + 1];
                        const diffJours = (dp.date - nextPerf.date) / (1000 * 60 * 60 * 24);
                        return diffJours > 30;
                    });
                    coursesDepuisAbsence = (indexAbsence === -1) ? perf.dernieresPerformances.length : indexAbsence;
                } else if (perf.dernieresPerformances.length === 1) {
                    coursesDepuisAbsence = 1;
                }
                grille.coursesApresAbsence.push(coursesDepuisAbsence);

            } else {
                ['ecartJours', 'sum_allocations_3d', 'ecartPoids', 'reussiteHippo', 'reussiteDistance', 'dernierReducKm', 'dernierMemeHippo', 'dernierNbPartants', 'formeMontante', 'nbPlaces_3d', 'meilleurePerfAbsolue_5d', 'recordVitesseHippo', 'ecartDistance', 'rkAdjusted', 'nbCoursesHippo', 'recordVitessePlatHippo', 'coursesApresAbsence', 'chevauxBattus3d', 'chevauxBattus3dPct'].forEach(key => {
                    if (grille[key]) {
                        grille[key].push(null);
                    }
                });
            }
        } catch (error) {
            console.error(`Erreur lors du traitement du partant ${p.numPmu}:`, error);
        }
    });

    const rankableCriteria = [
        { key: 'cote', direction: 'asc' }, { key: 'dernierePerfNorm', direction: 'asc' },
        { key: 'evolPerf', direction: 'desc' }, { key: 'moyennePerfAnnee', direction: 'asc' },
        { key: 'nbCoursesCarriere', direction: 'desc' }, { key: 'influenceJockey', direction: 'desc' },
        { key: 'influenceEntraineur', direction: 'desc' }, { key: 'influencePere', direction: 'desc' },
        { key: 'poids', direction: 'desc' },
        { key: 'valeur', direction: 'desc' }, { key: 'age', direction: 'asc' },
        { key: 'corde', direction: 'asc' }, { key: 'gainsCarriere', direction: 'desc' },
        { key: 'gainsAnneeEnCours', direction: 'desc' }, { key: 'gainsAnneePrecedente', direction: 'desc' },
        { key: 'gainsVictoires', direction: 'desc' }, { key: 'gainsPlace', direction: 'desc' },
        { key: 'ecartJours', direction: 'asc' }, { key: 'dernierReducKm', direction: 'asc' },
        { key: 'dernierNbPartants', direction: 'desc' },
        { key: 'sum_allocations_3d', direction: 'desc' }, { key: 'ecartPoids', direction: 'asc' }, 
        { key: 'reussiteHippo', direction: 'desc' }, { key: 'reussiteDistance', direction: 'desc' },
        { key: 'formeMontante', direction: 'desc'}, { key: 'nbPlaces_3d', direction: 'desc'},
        { key: 'meilleurePerfAbsolue_5d', direction: 'asc'}, { key: 'recordVitesseHippo', direction: 'asc'},
        { key: 'ecartDistance', direction: 'asc'},
        { key: 'rkAdjusted', direction: 'asc'}, { key: 'nbCoursesHippo', direction: 'desc'},
        { key: 'recordVitessePlatHippo', direction: 'desc' }
    ];

    rankableCriteria.forEach(criterion => {
        const rankKey = 'rank' + criterion.key.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
        if (grille[criterion.key]) {
            grille[rankKey] = getRanks(grille[criterion.key], criterion.direction);
        }
    });
    
    grille.pertinentCriteria = Object.keys(grille).filter(key => Array.isArray(grille[key]));

    return grille;
}

export function getUniqueValuesFromGrille(grille, columnKey) {
    if (!grille || !grille[columnKey]) return [];
    return [...new Set(grille[columnKey])]
        .filter(v => v !== 0 && v !== '' && v !== 'N/A' && v !== null)
        .sort((a, b) => {
            if (typeof a === 'string' && typeof b === 'string') {
                return a.localeCompare(b);
            }
            return a - b;
        });
}

function getSubCombinations(arr, size) {
    const result = [];
    function* rec(start, combo) {
        if (combo.length === size) {
            result.push([...combo]);
            return;
        }
        for (let i = start; i < arr.length; i++) {
            combo.push(arr[i]);
            yield* rec(i + 1, combo);
            combo.pop();
        }
    }
    Array.from(rec(0, []));
    return result;
}

export function factorizeCombinations(combinations, betSize) {
    const trackedCombos = combinations.map(c => ({ combo: [...c].sort((a, b) => a - b), processed: false }));
    const finalResult = [];
    for (let baseSize = betSize - 1; baseSize >= 1; baseSize--) {
        const groups = new Map();
        for (const tracked of trackedCombos) {
            if (tracked.processed) continue;
            const subBases = getSubCombinations(tracked.combo, baseSize);
            for (const base of subBases) {
                const key = base.join('-');
                if (!groups.has(key)) {
                    groups.set(key, []);
                }
                groups.get(key).push(tracked);
            }
        }
        const processableGroups = Array.from(groups.values())
            .filter(items => items.length > 1)
            .sort((a, b) => b.length - a.length);
        for (const items of processableGroups) {
            const unprocessedItems = items.filter(t => !t.processed);
            if (unprocessedItems.length < 2) continue;
            const base = getSubCombinations(unprocessedItems[0].combo, baseSize).find(subBase => {
                const key = subBase.join('-');
                return groups.get(key) === items;
            });
            if (base) {
                const complements = unprocessedItems.map(t => t.combo.filter(n => !base.includes(n))).flat();
                const uniqueComplements = [...new Set(complements)].sort((a, b) => a - b);
                finalResult.push({ base, complements: uniqueComplements, isFactored: true });
                unprocessedItems.forEach(t => t.processed = true);
            }
        }
    }
    const nonFactored = trackedCombos
        .filter(t => !t.processed)
        .map(t => ({ base: t.combo, complements: [], isFactored: false }));
    return [...finalResult, ...nonFactored];
}

function* genererCombinaisons(numbersArray, size) {
    const combo = new Array(size);
    const n = numbersArray.length;
    function* rec(start, depth) {
        if (depth === size) {
            yield [...combo];
            return;
        }
        for (let i = start; i < n; i++) {
            combo[depth] = numbersArray[i];
            yield* rec(i + 1, depth + 1);
        }
    }
    yield* rec(0, 0);
}

function* filterVect(iter, vectSet, min, max) {
    for (const c of iter) {
        const count = c.filter(num => vectSet.has(num)).length;
        if (count >= min && count <= max) yield c;
    }
}

function* filterSom(iter, min, max, grille, column, numIndex) {
    const colData = grille[column];
    for (const c of iter) {
        let sum = 0;
        let isValid = true;
        for (const num of c) {
            const idx = numIndex[num];
            if (idx === undefined) { isValid = false; break; }
            sum += colData[idx];
        }
        if (isValid && sum >= min && sum <= max) yield c;
    }
}

function* filterComb(iter, value, min, max, grille, column, numIndex) {
    const colData = grille[column];
    const targetValue = String(value).toUpperCase();
    for (const c of iter) {
        let count = 0;
        let isValid = true;
        for (const num of c) {
            const idx = numIndex[num];
            if (idx === undefined) { isValid = false; break; }
            if (String(colData[idx]).toUpperCase() === targetValue) count++;
        }
        if (isValid && count >= min && count <= max) yield c;
    }
}

function* filterGap(iter, min, max, grille, column, numIndex) {
    const colData = grille[column];
    for (const c of iter) {
        let isValid = true;
        const values = c.map(num => {
            const idx = numIndex[num];
            if (idx === undefined || colData[idx] === null) {
                isValid = false;
            }
            return colData[idx];
        }).sort((a, b) => a - b);

        if (!isValid) continue;

        let gapCount = 0;
        for (let i = 1; i < values.length; i++) {
            if (values[i] - values[i - 1] === 1) gapCount++;
        }
        if (gapCount >= min && gapCount <= max) yield c;
    }
}
function* filterKtg(iter, freq, min, max, grille, column, numIndex) {
    const colData = grille[column];
    for (const c of iter) {
        const groupCounts = {};
        let isValid = true;
        for (const num of c) {
            const idx = numIndex[num];
            if (idx === undefined) { isValid = false; break; }
            const value = colData[idx];
            groupCounts[value] = (groupCounts[value] || 0) + 1;
        }
        if (isValid) {
            const groupsOfFreq = Object.values(groupCounts).filter(cnt => cnt === freq).length;
            if (groupsOfFreq >= min && groupsOfFreq <= max) yield c;
        }
    }
}

function* filterOrder(iter, percentage, grille, column, numIndex, starterNumbers) {
const allScores = starterNumbers.map(num => ({ num, score: grille[column][numIndex[num]] }));
allScores.sort((a, b) => a.score - b.score);
const scoreMap = Object.fromEntries(allScores.map((item, index) => [item.num, index + 1]));

const buffer = [];
for (const c of iter) {
    let comboScore = 0;
    for (const num of c) {
        comboScore += scoreMap[num] || 0;
    }
    buffer.push({ combo: c, score: comboScore });
}

buffer.sort((a, b) => a.score - b.score);

const countToKeep = Math.round(buffer.length * Math.abs(percentage) / 100);
const selected = percentage >= 0
    ? buffer.slice(0, countToKeep)
    : buffer.slice(buffer.length - countToKeep);

for (const item of selected) yield item.combo;
}
export function applyAllFilters(grille, functions, betType, limit = 10000) {
    const numIndex = Object.fromEntries(grille.num.map((n, i) => [n, i]));
    const starterNumbers = grille.num.filter((num, i) => grille.statut[i] === 'PARTANT');
    
    if (starterNumbers.length < betType) {
        return { combinations: [], limitReached: false };
    }

    let iter = genererCombinaisons(starterNumbers, betType);
    const orderFilter = functions.find(f => f.name === 'ORDER' && f.active);
    const otherFilters = functions.filter(f => f.name !== 'ORDER');
    
    const applyFilters = (iterator, filterList) => {
        for (const f of filterList) {
            if (!f.active) continue;
            let min = parseFloat(f.min || 0);
            let max = parseFloat(f.max || Infinity);
            if (!isNaN(min) && !isNaN(max) && min > max) {
                [min, max] = [max, min];
            }
            switch (f.name) {
                case 'VECT':
                    const vectSet = new Set((f.vect || '').split(/[\s,]+/).map(Number));
                    iterator = filterVect(iterator, vectSet, min, max);
                    break;
                    case 'SOM':
		    iterator = filterSom(iterator, min, max, grille, f.column, numIndex);
		    break;
		    case 'GAP':
		    iterator = filterGap(iterator, min, max, grille, f.column, numIndex);
		    break;
		    case 'KTG':
                    iterator = filterKtg(iterator, parseInt(f.value || 2), min, max, grille, f.column, numIndex);
                    break;
            }
        }
        return iterator;
    };
    
    iter = applyFilters(iter, otherFilters);

    if (orderFilter) {
        iter = filterOrder(iter, parseFloat(orderFilter.percentage || 50), grille, orderFilter.column, numIndex);
    }
    
    const combinations = [];
    let limitReached = false;
    for (const combo of iter) {
        combinations.push(combo);
        if (combinations.length >= limit) {
            limitReached = true;
            break;
        }
    }
    
    return { combinations, limitReached };
}