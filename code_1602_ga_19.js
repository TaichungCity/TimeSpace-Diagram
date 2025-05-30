// At the top of code_1602_ga_19.js
let saInitialTemp = 1000;
let saCoolingRate = 0.95;
let saMinTemp = 1;

let nsgaIIForTwoPopulationSize = 50;
let nsgaIIForTwoMaxGenerations = 5;

let nsgaIIPopulationSize = 20; // For multi-objective (>=3 spawn points)
let nsgaIIMaxGenerations = 10; // For multi-objective (>=3 spawn points)

let commonMutationRate = 0.1; // Used by both NSGA-II variants


// 全局變數儲存 GA 結果
let gaBestIndividual = null;
let gaBestFitness = null;
let paretoSolutionsGlobal = [];

// 新增一個全域變數來輔助匯出時識別正確的 optimizableCircles
window.lastOptimizableCirclesForParetoExport = [];

// 提取為全局函數
function calculateFitness(individual, optimizableCircles) {
  const resultJson = applyOffsetsAndCompute(individual, optimizableCircles, false);
  const result = JSON.parse(resultJson);
  return result.spawnProbabilities.reduce((sum, spawn) => {
    const prob = spawn.probability === "未模擬" ? 0 : parseFloat(spawn.probability);
    return sum + prob;
  }, 0);
}

function applyOffsetsAndCompute(offsets, circlesToOptimize, shouldDraw = false) {
  circlesToOptimize.forEach((circle, index) => {
    if (!circle.refMaster) {
      circle.offset = Math.max(0, Math.min(Math.floor(offsets[index]), getCycleLength(circle)));
    }
  });

  gridCircles.forEach(circle => {
    if (circle.refMaster) {
      const masterCircle = gridCircles.find(c => `${c.row}-${c.col}` === circle.refMaster);
      if (masterCircle) {
        circle.offset = masterCircle.offset;
      } else {
        console.warn(`未找到路口 ${circle.row}-${circle.col} 的主燈號路口 ${circle.refMaster}`);
      }
    }
  });

  if (shouldDraw) drawDesignGrid();
  reFresh();

  const spawnProbabilities = spawnPointsList.map((spawn, spawnIndex) => {
    const prevSelectedSpawnIndex = selectedSpawnIndex;
    selectedSpawnIndex = spawnIndex;
    const greenWaveData = computeGreenWavePaths();
    selectedSpawnIndex = prevSelectedSpawnIndex;

    const probability = fixedSimulationDuration && timeScale && greenWaveData.totalGreenWaveTime !== undefined
      ? ((greenWaveData.totalGreenWaveTime / (fixedSimulationDuration / timeScale)) * 100).toFixed(2)
      : "未模擬";
    const maxGreenWaveTime = greenWaveData.maxGreenWaveTime !== undefined
      ? (greenWaveData.maxGreenWaveTime * timeScale).toFixed(2)
      : "未模擬";

    return { probability, maxGreenWaveTime, spawnIndex: spawnIndex + 1 };
  });

  return JSON.stringify({ spawnProbabilities }, null, 2);
}

// 動態選擇優化方法
document.getElementById("optimizeOffsetBtn").addEventListener("click", function() {
  const originalIndex = selectedSpawnIndex;
  const spawnCount = spawnPointsList.length;

  let result;
  if (spawnCount === 1) {
    result = optimizeSA();
  } else if (spawnCount === 2) {
    result = optimizeNSGAIIForTwoSpawnPoints();
  } else if (spawnCount >= 3) {
    result = optimizeNSGAII();
  } else {
    alert("沒有設置生成點，請先配置生成點！");
    return;
  }

  if (result) {
    console.log(`優化後的結果（生成點數：${spawnCount}）：`, result);
    selector.selectedIndex = originalIndex;
  }
});

function optimizeSA() {
  const originalIndex = selectedSpawnIndex;
  showLoadingOverlay();
  updateLoadingText("正在執行單目標時差優化...");
  updateLoadingProgress(0);

  setTimeout(() => {
    const optimizableCircles = gridCircles.filter(circle => circle.selected && !circle.locked && !circle.refMaster);
    if (optimizableCircles.length === 0) {
      alert("沒有可優化的路口，請選擇未鎖定且未引用主燈號的路口！");
      hideLoadingOverlay();
      return null;
    }

    const cycleLengths = optimizableCircles.map(circle => getCycleLength(circle));
    let currentSolution, currentFitness;

    if (!gaBestIndividual || gaBestFitness === null) {
      currentSolution = cycleLengths.map(cycle => Math.floor(Math.random() * (cycle + 1)));
      currentFitness = calculateFitness(currentSolution, optimizableCircles);
    } else {
      currentSolution = gaBestIndividual.slice();
      currentFitness = gaBestFitness;
    }

	const initialTemp = saInitialTemp;
	const coolingRate = saCoolingRate;
	const minTemp = saMinTemp;

    let bestIndividual = currentSolution.slice();
    let bestFitness = currentFitness;
    const fitnessHistory = [];

    let temperature = initialTemp;
    let iteration = 0;
    const totalIterations = Math.ceil(Math.log(minTemp / initialTemp) / Math.log(coolingRate));

    function runSAIteration() {
      if (temperature > minTemp) {
        iteration++;
        const progress = (Math.log(temperature / initialTemp) / Math.log(minTemp / initialTemp)) * 100;
        updateLoadingText(`單目標優化中 - 進度: ${progress.toFixed(1)}%，目標值: ${bestFitness.toFixed(2)}%`);
        updateLoadingProgress(progress);
        selector.selectedIndex = originalIndex;

        const newSolution = currentSolution.slice();
        const indexToChange = Math.floor(Math.random() * newSolution.length);
        const cycle = cycleLengths[indexToChange];
        newSolution[indexToChange] = Math.floor(Math.random() * (cycle + 1));

        const newFitness = calculateFitness(newSolution, optimizableCircles);
        const deltaFitness = newFitness - currentFitness;

        if (deltaFitness > 0 || Math.random() < Math.exp(deltaFitness / temperature)) {
          currentSolution = newSolution;
          currentFitness = newFitness;
          if (currentFitness > bestFitness) {
            bestFitness = currentFitness;
            bestIndividual = currentSolution.slice();
            fitnessHistory.push(bestFitness);
          }
        }

        temperature *= coolingRate;
        requestAnimationFrame(runSAIteration);
      } else {
        optimizableCircles.forEach((circle, index) => {
          circle.offset = Math.max(0, Math.min(Math.floor(bestIndividual[index]), cycleLengths[index]));
        });
        const finalResultJson = applyOffsetsAndCompute(bestIndividual, optimizableCircles, true);

        gaBestIndividual = bestIndividual.slice();
        gaBestFitness = bestFitness;

        drawDesignGrid();
        updateLoadingText("單目標優化完成！");
        updateLoadingProgress(100);
        selector.selectedIndex = originalIndex;

        setTimeout(() => {
          hideLoadingOverlay();
          renderSpawnDataDisplay();
          console.log("SA 優化完成，最佳時差配置：", bestIndividual);
          console.log("SA 最終結果：", JSON.parse(finalResultJson));
          alert(`單目標優化完成！最佳通過機率: ${bestFitness.toFixed(2)}%`);
        }, 500);

        return finalResultJson;
      }
    }

    requestAnimationFrame(runSAIteration);
  }, 0);
}

function optimizeNSGAII() {
  const originalIndex = selectedSpawnIndex;
  showLoadingOverlay();
  updateLoadingText("正在執行多目標 NSGA-II 時差優化...");
  updateLoadingProgress(0);

  setTimeout(() => {
    const optimizableCircles = gridCircles.filter(circle => circle.selected && !circle.locked && !circle.refMaster);
    if (optimizableCircles.length === 0) {
      alert("沒有可優化的路口，請選擇未鎖定且未引用主燈號的路口！");
      hideLoadingOverlay();
      return null;
    }

    const cycleLengths = optimizableCircles.map(circle => getCycleLength(circle));
    const populationSize = nsgaIIPopulationSize; // 或者您原本設定的值
    const maxGenerations = nsgaIIMaxGenerations; // 或者您原本設定的值
    let generation = 0;

    function calculateMultiObjectiveFitness(individual) {
      const resultJson = applyOffsetsAndCompute(individual, optimizableCircles, false);
      const result = JSON.parse(resultJson);
      return result.spawnProbabilities.map(spawn =>
        spawn.probability === "未模擬" ? 0 : parseFloat(spawn.probability)
      );
    }

    function initializePopulation() {
      const population = [];
      for (let i = 0; i < populationSize; i++) {
        const individual = cycleLengths.map(cycle => Math.floor(Math.random() * (cycle + 1)));
        population.push({ individual, fitnessVector: calculateMultiObjectiveFitness(individual) });
      }
      return population;
    }

    function dominates(vec1, vec2) {
      let betterInOne = false;
      for (let i = 0; i < vec1.length; i++) {
        if (vec1[i] < vec2[i]) return false;
        if (vec1[i] > vec2[i]) betterInOne = true;
      }
      return betterInOne;
    }

    function nonDominatedSort(population) {
      if (!population || population.length === 0) return [[]];
      const fronts = [[]];
      const dominationCount = new Map();
      const dominatedSolutions = new Map();

      population.forEach((p, i) => {
        dominationCount.set(i, 0);
        dominatedSolutions.set(i, []);
        population.forEach((q, j) => {
          if (i !== j) {
            if (dominates(p.fitnessVector, q.fitnessVector)) {
              dominatedSolutions.get(i).push(j);
            } else if (dominates(q.fitnessVector, p.fitnessVector)) {
              dominationCount.set(i, dominationCount.get(i) + 1);
            }
          }
        });
        if (dominationCount.get(i) === 0) fronts[0].push(i);
      });

      let frontIndex = 0;
      while (fronts[frontIndex].length > 0) {
        const nextFront = [];
        fronts[frontIndex].forEach(i => {
          dominatedSolutions.get(i).forEach(j => {
            dominationCount.set(j, dominationCount.get(j) - 1);
            if (dominationCount.get(j) === 0) nextFront.push(j);
          });
        });
        frontIndex++;
        fronts.push(nextFront);
      }
      return fronts.filter(front => front.length > 0).map(front => front.map(i => population[i]));
    }

    function calculateCrowdingDistance(front) {
      if (!front || front.length === 0) return [];
      const numObjectives = front[0].fitnessVector.length;
      const distances = new Array(front.length).fill(0);

      for (let m = 0; m < numObjectives; m++) {
        front.sort((a, b) => a.fitnessVector[m] - b.fitnessVector[m]);
        distances[0] = Infinity;
        distances[front.length - 1] = Infinity;
        const minVal = front[0].fitnessVector[m];
        const maxVal = front[front.length - 1].fitnessVector[m];
        if (maxVal === minVal) continue;
        for (let i = 1; i < front.length - 1; i++) {
          distances[i] += (front[i + 1].fitnessVector[m] - front[i - 1].fitnessVector[m]) / (maxVal - minVal);
        }
      }
      return distances;
    }

    function tournamentSelection(population, fronts, crowdingDistances) {
        const i = Math.floor(Math.random() * population.length);
        const j = Math.floor(Math.random() * population.length);
    
        const findFrontIndex = (p) => fronts.findIndex(front => front.some(sol => sol === p));
        
        const frontI_idx = findFrontIndex(population[i]);
        const frontJ_idx = findFrontIndex(population[j]);
    
        // Fallback to a large number if not found in any front (should not happen with correct logic)
        const frontI = frontI_idx !== -1 ? frontI_idx : fronts.length;
        const frontJ = frontJ_idx !== -1 ? frontJ_idx : fronts.length;
    
        if (frontI < frontJ) return population[i];
        if (frontJ < frontI) return population[j];
    
        // If in the same front, compare crowding distance
        // Ensure fronts[frontI] is valid and population[i] is in it
        const currentFront = fronts[frontI];
        if (!currentFront) return population[i]; // Should not happen

        const indexInFrontI = currentFront.findIndex(sol => sol === population[i]);
        const indexInFrontJ = currentFront.findIndex(sol => sol === population[j]);

        // Ensure crowdingDistances map correctly to the combined list from all fronts
        // This requires careful indexing if crowdingDistances is a flat array.
        // Let's assume crowdingDistances is an array of arrays, matching `fronts`.
        // If it's flat, then the indices must be calculated based on cumulative lengths of previous fronts.

        // Simplified: Assuming crowdingDistances is flat and correctly ordered.
        // This part of tournamentSelection logic can be tricky with flat crowdingDistances.
        // A safer way is to store crowding distance directly on the solution object within its front.

        // For this example, we'll stick to the assumption that crowdingDistances are somehow correctly mapped.
        // The original code's crowdingDistances.flat() implies a flat array.
        // We need to find the absolute index in the flattened list.
        let absoluteIndexI = 0;
        for(let k=0; k<frontI; ++k) absoluteIndexI += fronts[k].length;
        absoluteIndexI += indexInFrontI;

        let absoluteIndexJ = 0;
        for(let k=0; k<frontJ; ++k) absoluteIndexJ += fronts[k].length;
        absoluteIndexJ += indexInFrontJ;

        if (indexInFrontI === -1 || indexInFrontJ === -1) return population[i]; // Fallback
        
        // Make sure absoluteIndexI and J are within bounds of the flattened crowdingDistances
        if (crowdingDistances[absoluteIndexI] === undefined || crowdingDistances[absoluteIndexJ] === undefined) return population[i];

        return crowdingDistances[absoluteIndexI] > crowdingDistances[absoluteIndexJ] ? population[i] : population[j];
    }

    function crossover(parent1, parent2) {
      const point = Math.floor(Math.random() * parent1.individual.length);
      const child1 = { individual: [...parent1.individual.slice(0, point), ...parent2.individual.slice(point)], fitnessVector: [] };
      const child2 = { individual: [...parent2.individual.slice(0, point), ...parent1.individual.slice(point)], fitnessVector: [] };
      child1.fitnessVector = calculateMultiObjectiveFitness(child1.individual);
      child2.fitnessVector = calculateMultiObjectiveFitness(child2.individual);
      return [child1, child2];
    }

    function mutate(individual) {
      const mutated = individual.individual.slice();
      const index = Math.floor(Math.random() * mutated.length);
      mutated[index] = Math.floor(Math.random() * (cycleLengths[index] + 1));
      return { individual: mutated, fitnessVector: calculateMultiObjectiveFitness(mutated) };
    }

    let population = initializePopulation();

    function runNSGAIIIteration() {
      if (generation < maxGenerations) {
        generation++;
        const progress = (generation / maxGenerations) * 100;
        updateLoadingText(`多目標 NSGA-II 優化中 - 進度: ${progress.toFixed(1)}%`);
        updateLoadingProgress(progress);
        if (document.getElementById("spawnPointSelector") && originalIndex < document.getElementById("spawnPointSelector").options.length && originalIndex >=0) {
            selector.selectedIndex = originalIndex;
        }


        const fronts = nonDominatedSort(population);
        // Ensure crowdingDistances is correctly calculated and flattened if needed by tournamentSelection
        const allCrowdingDistances = fronts.map(front => calculateCrowdingDistance(front)).flat();


        const offspring = [];
        while (offspring.length < populationSize) {
          const parent1 = tournamentSelection(population, fronts, allCrowdingDistances);
          const parent2 = tournamentSelection(population, fronts, allCrowdingDistances);
          const [child1, child2] = crossover(parent1, parent2);
          offspring.push(Math.random() < commonMutationRate ? mutate(child1) : child1);
          if (offspring.length < populationSize) offspring.push(Math.random() < commonMutationRate ? mutate(child2) : child2);
        }

        population = population.concat(offspring);
        const newFronts = nonDominatedSort(population);
        const newPopulation = [];
        let remainingSize = populationSize;

        for (const front of newFronts) {
          if (!front) continue;
          if (front.length <= remainingSize) {
            newPopulation.push(...front);
            remainingSize -= front.length;
          } else {
            const distances = calculateCrowdingDistance(front); // Distances for this specific front
            const sortedFront = front.map((sol, i) => ({ sol, distance: distances[i] }))
              .sort((a, b) => b.distance - a.distance)
              .slice(0, remainingSize)
              .map(item => item.sol);
            newPopulation.push(...sortedFront);
            break;
          }
        }
        population = newPopulation;

        requestAnimationFrame(runNSGAIIIteration);
      } else { // NSGA-II 迭代完成
        const finalFronts = nonDominatedSort(population);
        paretoSolutionsGlobal = finalFronts[0] || [];
        updateLoadingText("多目標 NSGA-II 優化完成，正在準備選擇介面...");
        updateLoadingProgress(100);
         if (document.getElementById("spawnPointSelector") && originalIndex < document.getElementById("spawnPointSelector").options.length && originalIndex >=0) {
            selector.selectedIndex = originalIndex;
        }

        // 將當前的 optimizableCircles (即執行優化時的列表) 儲存起來供匯出使用
        // optimizableCircles 變數在此函數作用域內是定義好的
        window.lastOptimizableCirclesForParetoExport = [...optimizableCircles];

        setTimeout(() => {
          hideLoadingOverlay();
          // cycleLengths 也應對應 finalOptimizableCircles (即此處的 optimizableCircles)
          const cycleLengthsForPareto = optimizableCircles.map(circle => getCycleLength(circle));
          showParetoSelectionInterface(paretoSolutionsGlobal, optimizableCircles, cycleLengthsForPareto, originalIndex);
        }, 500);
      }
    }
    requestAnimationFrame(runNSGAIIIteration);
  }, 0);
}

function optimizeNSGAIIForTwoSpawnPoints() {
  const originalIndex = selectedSpawnIndex;
  showLoadingOverlay();
  updateLoadingText("正在執行雙目標 NSGA-II 時差優化...");
  updateLoadingProgress(0);

  setTimeout(() => {
    const optimizableCircles = gridCircles.filter(circle => circle.selected && !circle.locked && !circle.refMaster);
    if (optimizableCircles.length === 0) {
      alert("沒有可優化的路口，請選擇未鎖定且未引用主燈號的路口！");
      hideLoadingOverlay();
      return null;
    }

    if (spawnPointsList.length !== 2) {
      alert("生成點數量必須為 2 個！");
      hideLoadingOverlay();
      return null;
    }

    const cycleLengths = optimizableCircles.map(circle => getCycleLength(circle));
    const populationSize = nsgaIIForTwoPopulationSize;
    const maxGenerations = nsgaIIForTwoMaxGenerations;
    let generation = 0;

    function calculateMultiObjectiveFitness(individual) {
      const resultJson = applyOffsetsAndCompute(individual, optimizableCircles, false);
      const result = JSON.parse(resultJson);
      const probs = result.spawnProbabilities.map(spawn => 
        spawn.probability === "未模擬" ? 0 : parseFloat(spawn.probability)
      );
      return [probs[0], probs[1]];
    }

    function initializePopulation() {
      const population = [];
      for (let i = 0; i < populationSize; i++) {
        const individual = cycleLengths.map(cycle => Math.floor(Math.random() * (cycle + 1)));
        population.push({ individual, fitnessVector: calculateMultiObjectiveFitness(individual) });
      }
      return population;
    }

    function dominates(vec1, vec2) {
      let betterInOne = false;
      for (let i = 0; i < vec1.length; i++) {
        if (vec1[i] < vec2[i]) return false;
        if (vec1[i] > vec2[i]) betterInOne = true;
      }
      return betterInOne;
    }

    function nonDominatedSort(population) {
      if (!population || population.length === 0) return [[]];
      const fronts = [[]];
      const dominationCount = new Map();
      const dominatedSolutions = new Map();

      population.forEach((p, i) => {
        dominationCount.set(i, 0);
        dominatedSolutions.set(i, []);
        population.forEach((q, j) => {
          if (i !== j) {
            if (dominates(p.fitnessVector, q.fitnessVector)) {
              dominatedSolutions.get(i).push(j);
            } else if (dominates(q.fitnessVector, p.fitnessVector)) {
              dominationCount.set(i, dominationCount.get(i) + 1);
            }
          }
        });
        if (dominationCount.get(i) === 0) fronts[0].push(i);
      });

      let frontIndex = 0;
      while (fronts[frontIndex].length > 0) {
        const nextFront = [];
        fronts[frontIndex].forEach(i => {
          dominatedSolutions.get(i).forEach(j => {
            dominationCount.set(j, dominationCount.get(j) - 1);
            if (dominationCount.get(j) === 0) nextFront.push(j);
          });
        });
        frontIndex++;
        fronts.push(nextFront);
      }
      return fronts.filter(front => front.length > 0).map(front => front.map(i => population[i]));
    }

    function calculateCrowdingDistance(front) {
      if (!front || front.length === 0) return [];
      const numObjectives = 2;
      const distances = new Array(front.length).fill(0);

      for (let m = 0; m < numObjectives; m++) {
        front.sort((a, b) => a.fitnessVector[m] - b.fitnessVector[m]);
        distances[0] = Infinity;
        distances[front.length - 1] = Infinity;
        const minVal = front[0].fitnessVector[m];
        const maxVal = front[front.length - 1].fitnessVector[m];
        if (maxVal === minVal) continue;
        for (let i = 1; i < front.length - 1; i++) {
          distances[i] += (front[i + 1].fitnessVector[m] - front[i - 1].fitnessVector[m]) / (maxVal - minVal);
        }
      }

      front.forEach((sol, i) => {
        const p1 = sol.fitnessVector[0];
        const p2 = sol.fitnessVector[1];
        const ratio = p1 / p2;
        const ratioDeviation = Math.abs(ratio - 1);
        distances[i] = distances[i] === Infinity ? Infinity : distances[i] * (1 / (1 + ratioDeviation));
      });

      return distances;
    }

    function tournamentSelection(population, fronts, crowdingDistances) {
      const i = Math.floor(Math.random() * population.length);
      const j = Math.floor(Math.random() * population.length);
      const frontI = fronts.findIndex(front => front.some(sol => sol === population[i])) || fronts.length;
      const frontJ = fronts.findIndex(front => front.some(sol => sol === population[j])) || fronts.length;

      if (frontI < frontJ) return population[i];
      if (frontJ < frontI) return population[j];
      const indexI = fronts[frontI]?.findIndex(sol => sol === population[i]) ?? -1;
      const indexJ = fronts[frontJ]?.findIndex(sol => sol === population[j]) ?? -1;
      if (indexI === -1 || indexJ === -1) return population[i];
      return crowdingDistances[indexI] > crowdingDistances[indexJ] ? population[i] : population[j];
    }

    function crossover(parent1, parent2) {
      const point = Math.floor(Math.random() * parent1.individual.length);
      const child1 = { individual: [...parent1.individual.slice(0, point), ...parent2.individual.slice(point)], fitnessVector: [] };
      const child2 = { individual: [...parent2.individual.slice(0, point), ...parent1.individual.slice(point)], fitnessVector: [] };
      child1.fitnessVector = calculateMultiObjectiveFitness(child1.individual);
      child2.fitnessVector = calculateMultiObjectiveFitness(child2.individual);
      return [child1, child2];
    }

    function mutate(individual) {
      const mutated = individual.individual.slice();
      const index = Math.floor(Math.random() * mutated.length);
      mutated[index] = Math.floor(Math.random() * (cycleLengths[index] + 1));
      return { individual: mutated, fitnessVector: calculateMultiObjectiveFitness(mutated) };
    }

    let population = initializePopulation();

    function runNSGAIIIteration() {
      if (generation < maxGenerations) {
        generation++;
        const progress = (generation / maxGenerations) * 100;
        updateLoadingText(`雙目標 NSGA-II 優化中 - 進度: ${progress.toFixed(1)}%`);
        updateLoadingProgress(progress);
        selector.selectedIndex = originalIndex;

        const fronts = nonDominatedSort(population);
        const crowdingDistances = fronts.map(front => calculateCrowdingDistance(front)).flat();

        const offspring = [];
        while (offspring.length < populationSize) {
          const parent1 = tournamentSelection(population, fronts, crowdingDistances);
          const parent2 = tournamentSelection(population, fronts, crowdingDistances);
          const [child1, child2] = crossover(parent1, parent2);
          offspring.push(Math.random() < commonMutationRate ? mutate(child1) : child1);
          if (offspring.length < populationSize) offspring.push(Math.random() < commonMutationRate ? mutate(child2) : child2);
        }

        population = population.concat(offspring);
        const newFronts = nonDominatedSort(population);
        const newPopulation = [];
        let remainingSize = populationSize;

        for (const front of newFronts) {
          if (!front) continue;
          if (front.length <= remainingSize) {
            newPopulation.push(...front);
            remainingSize -= front.length;
          } else {
            const distances = calculateCrowdingDistance(front);
            const sortedFront = front.map((sol, i) => ({ sol, distance: distances[i] }))
              .sort((a, b) => b.distance - a.distance)
              .slice(0, remainingSize)
              .map(item => item.sol);
            newPopulation.push(...sortedFront);
            break;
          }
        }
        population = newPopulation;

        requestAnimationFrame(runNSGAIIIteration);
      } else {
        const finalFronts = nonDominatedSort(population);
        let paretoSolutions = finalFronts[0] || [];

        paretoSolutions = paretoSolutions
          .map(sol => ({
            ...sol,
            ratioDeviation: Math.abs(sol.fitnessVector[0] / sol.fitnessVector[1] - 1)
          }))
          .sort((a, b) => a.ratioDeviation - b.ratioDeviation)
          .slice(0, 10);

        paretoSolutionsGlobal = paretoSolutions;
        updateLoadingText("雙目標 NSGA-II 優化完成，正在準備選擇介面...");
        updateLoadingProgress(100);
        selector.selectedIndex = originalIndex;
		
        // 將當前的 optimizableCircles (即執行優化時的列表) 儲存起來供匯出使用
        // optimizableCircles 變數在此函數作用域內是定義好的
        window.lastOptimizableCirclesForParetoExport = [...optimizableCircles];		

        setTimeout(() => {
          hideLoadingOverlay();
          showParetoSelectionInterface(paretoSolutionsGlobal, optimizableCircles, cycleLengths, originalIndex);
        }, 500);
      }
    }

    requestAnimationFrame(runNSGAIIIteration);
  }, 0);
}

function showParetoSelectionInterface(paretoSolutions, activeOptimizableCircles, cycleLengthsForActive, originalIndex) {
  const paretoDiv = document.getElementById("Pareto");
  if (!paretoDiv) {
    console.error("未找到 id='Pareto' 的元素");
    return;
  }

  paretoDiv.innerHTML = ""; // 清空

  const title = document.createElement("h3");
  title.textContent = "選擇 Pareto 最優解";
  paretoDiv.appendChild(title);

  if (paretoSolutions.length === 0) {
      const noSolutionsMsg = document.createElement("p");
      noSolutionsMsg.textContent = "沒有可供選擇的 Pareto 解。";
      paretoDiv.appendChild(noSolutionsMsg);
      return;
  }

  const select = document.createElement("select");
  select.style.width = "100%";
  select.style.marginBottom = "10px";
  paretoSolutions.forEach((sol, index) => {
    const option = document.createElement("option");
    option.value = index;
    const fitnessSum = sol.fitnessVector.reduce((s, f) => s + f, 0);
    option.textContent = `解 ${index + 1}: [${sol.fitnessVector.map(f => f.toFixed(2)).join(", ")}]% (總和: ${fitnessSum.toFixed(2)}%)`;
    select.appendChild(option);
  });
  paretoDiv.appendChild(select);

  //const applyBtn = document.createElement("button");
  //applyBtn.textContent = "確定選擇";
  //applyBtn.style.marginRight = "10px";
  //applyBtn.onclick = () => {
    //const selectedIndex = parseInt(select.value);
    //if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= paretoSolutions.length) {
        //alert("請選擇一個有效的 Pareto 解。");
        //return;
    //}
    //const selectedSolution = paretoSolutions[selectedIndex];
    //applySelectedSolution(selectedSolution, activeOptimizableCircles, cycleLengthsForActive, paretoSolutions, originalIndex);
  //};
  //paretoDiv.appendChild(applyBtn);

  // 修改 onchange 事件，直接觸發 applySelectedSolution
  select.onchange = () => {
      const selectedIndex = parseInt(select.value);
      if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= paretoSolutions.length) {
          alert("請選擇一個有效的 Pareto 解。");
          return;
      }
      const selectedSolution = paretoSolutions[selectedIndex];
      applySelectedSolution(selectedSolution, activeOptimizableCircles, cycleLengthsForActive, paretoSolutions, originalIndex);
  };

  // 初始應用第一個解（如果存在）
  if (paretoSolutions.length > 0) {
      select.dispatchEvent(new Event('change'));
  }
}

function applySelectedSolution(selectedSolution, activeOptimizableCircles, cycleLengthsForActive, paretoSolutions, originalIndex) {
  if (!selectedSolution || !selectedSolution.individual || !activeOptimizableCircles || !cycleLengthsForActive) {
    console.error("applySelectedSolution: 缺少必要的參數。");
    alert("套用 Pareto 解時發生錯誤，缺少參數。");
    return;
  }
  if (selectedSolution.individual.length !== activeOptimizableCircles.length) {
    console.error(`applySelectedSolution: 時差數量 (${selectedSolution.individual.length}) 與可優化路口數量 (${activeOptimizableCircles.length}) 不符。`);
    alert("套用 Pareto 解時發生錯誤，時差與路口數量不符。");
    return;
  }
   if (cycleLengthsForActive.length !== activeOptimizableCircles.length) {
    console.error(`applySelectedSolution: 週期長度數量 (${cycleLengthsForActive.length}) 與可優化路口數量 (${activeOptimizableCircles.length}) 不符。`);
    alert("套用 Pareto 解時發生錯誤，週期長度與路口數量不符。");
    return;
  }


  // 1. 將 selectedSolution.individual 中的時差應用到 activeOptimizableCircles
  activeOptimizableCircles.forEach((circle, index) => {
    const offsetValue = parseFloat(selectedSolution.individual[index]);
    if (isNaN(offsetValue)) {
      console.warn(`時差值無效 (NaN) for circle ${circle.intersectionName || (circle.row + ',' + circle.col)} at index ${index}. Using 0.`);
      circle.offset = 0; // 或者使用 circle.offset 保持原樣，或拋出錯誤
    } else {
      circle.offset = Math.max(0, Math.min(Math.floor(offsetValue), cycleLengthsForActive[index]));
    }
  });

  // 2. 調用 applyOffsetsAndCompute，它會處理主控-引用關係
  const finalResultJson = applyOffsetsAndCompute(selectedSolution.individual, activeOptimizableCircles, true); // true 表示繪製

  // 更新 gaBestIndividual 和 gaBestFitness
  // 這裡假設我們想把選中的 Pareto 解 (或 Pareto 前緣中的某個代表解) 存為下一次優化的起點
  let bestParetoForGa;
  if (paretoSolutions && paretoSolutions.length > 0) {
      bestParetoForGa = paretoSolutions.reduce((best, sol) => {
          const sumCurrent = sol.fitnessVector.reduce((s, f) => s + f, 0);
          const sumBest = best.fitnessVector ? best.fitnessVector.reduce((s, f) => s + f, 0) : -Infinity;
          return sumCurrent > sumBest ? sol : best;
      }, paretoSolutions[0]); // 從 paretoSolutions 中選一個總體較好的
  } else {
      bestParetoForGa = selectedSolution; // 如果 paretoSolutions 為空，就用當前選的
  }
  

  if (bestParetoForGa && bestParetoForGa.individual) {
    gaBestIndividual = bestParetoForGa.individual.slice(); // 儲存針對 activeOptimizableCircles 的時差
    if (bestParetoForGa.fitnessVector && bestParetoForGa.fitnessVector.length > 0) {
        gaBestFitness = bestParetoForGa.fitnessVector.reduce((sum, f) => sum + f, 0);
    } else {
        gaBestFitness = null; // 或其他適當的預設值
    }
  }

  // UI 更新: reFresh() 在 applyOffsetsAndCompute 中被調用，會處理大部分UI更新
  // 但 selectedSpawnIndex 可能被 reFresh 內的 updateSpawnPointSelector 重置
  const spawnSelector = document.getElementById("spawnPointSelector");
  if (spawnSelector) {
    if (originalIndex >= 0 && originalIndex < spawnSelector.options.length) {
        spawnSelector.selectedIndex = originalIndex;
        selectedSpawnIndex = originalIndex;
    } else if (spawnSelector.options.length > 0) { // 如果 originalIndex 無效但有選項，選第一個
        spawnSelector.selectedIndex = 0;
        selectedSpawnIndex = 0;
    }
    // 手動觸發一次更新以確保UI同步 (因為 reFresh 後 selectedSpawnIndex 可能改變)
    // precomputeTrafficLightStates(); 
    // updateSpacetimeOffscreen();   
    // renderSpawnDataDisplay();  // 這三個通常在 reFresh 裡被調用，如果 reFresh 確保了同步，這裡可能多餘
    // 為了確保，如果 reFresh 沒有完全根據新的 selectedSpawnIndex 更新所有東西，可以再次調用：
    if (typeof selectedSpawnIndex === 'number') { // 確保 selectedSpawnIndex 有效
        precomputeTrafficLightStates(); 
        updateSpacetimeOffscreen();   
        renderSpawnDataDisplay();
    }
  }


  console.log("使用者選擇的解：", selectedSolution);
  console.log("最終結果：", JSON.parse(finalResultJson));
  ///alert(`已應用選擇的解！目標值: ${selectedSolution.fitnessVector.map(f => f.toFixed(2)).join(", ")}%`);
}

function setupParetoIO(originalIndexForContext) {
  const paretoIODiv = document.getElementById("ParetoIO");
  if (!paretoIODiv) {
    console.error("未找到 id='ParetoIO' 的元素");
    return;
  }

  paretoIODiv.innerHTML = ""; // 清空

  const exportBtn = document.createElement("button");
  exportBtn.textContent = "匯出 Pareto 解";
  exportBtn.style.marginRight = "10px";
  exportBtn.onclick = () => {
    if (paretoSolutionsGlobal.length === 0) {
      alert("目前沒有 Pareto 解可匯出！");
      return;
    }

    let optimizableCircleIdentifiersForExport;
    if (window.lastOptimizableCirclesForParetoExport && window.lastOptimizableCirclesForParetoExport.length > 0) {
        optimizableCircleIdentifiersForExport = window.lastOptimizableCirclesForParetoExport.map(c => ({
            row: c.row, col: c.col,
            intersectionName: c.intersectionName || ""
        }));
        if (paretoSolutionsGlobal[0].individual.length !== optimizableCircleIdentifiersForExport.length) {
            console.warn("匯出警告：儲存的 optimizableCircles 數量與 Pareto 解中的時差數量不符。將嘗試使用當前可優化路口。");
            const currentOptimizableCircles = gridCircles.filter(circle => circle.selected && !circle.locked && !circle.refMaster);
            optimizableCircleIdentifiersForExport = currentOptimizableCircles.map(c => ({
                row: c.row, col: c.col,
                intersectionName: c.intersectionName || ""
            }));
            if (paretoSolutionsGlobal[0].individual.length !== optimizableCircleIdentifiersForExport.length) {
                 alert("匯出錯誤：無法匹配 Pareto 解的時差數量與可優化路口數量。請重新執行優化後再嘗試匯出。");
                 return;
            }
        }
    } else {
        console.warn("匯出警告：未找到生成 Pareto 解時的特定可優化路口列表，將使用當前可優化路口列表。");
        const currentOptimizableCircles = gridCircles.filter(circle => circle.selected && !circle.locked && !circle.refMaster);
         if (paretoSolutionsGlobal.length > 0 && paretoSolutionsGlobal[0].individual.length !== currentOptimizableCircles.length) {
            alert("匯出錯誤：Pareto 解中的時差數量與當前可優化路口數量不符。請重新執行優化後再嘗試匯出。");
            return;
        }
        optimizableCircleIdentifiersForExport = currentOptimizableCircles.map(c => ({
            row: c.row, col: c.col,
            intersectionName: c.intersectionName || ""
        }));
    }

    const exportData = {
      optimizableCircleIdentifiers: optimizableCircleIdentifiersForExport,
      solutions: paretoSolutionsGlobal.map(solution => ({
        individualOffsets: solution.individual,
        fitnessVector: solution.fitnessVector
      }))
    };

    const jsonData = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pareto_solutions.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log("Pareto 解已匯出為 JSON");
  };
  paretoIODiv.appendChild(exportBtn);

  // 創建 file-upload-wrapper 容器
  const wrapper = document.createElement("div");
  wrapper.className = "file-upload-wrapper";

  const importLabel = document.createElement("label");
  importLabel.textContent = "匯入 Pareto 解";
  importLabel.className = "file-upload-label";
  importLabel.style.cursor = "pointer"; // 確保滑鼠顯示為指針

  importLabel.onclick = () => {
    // 動態創建隱藏的 file input
    const tempInput = document.createElement("input");
    tempInput.type = "file";
    tempInput.accept = ".json";
    tempInput.style.display = "none"; // 隱藏 input
    document.body.appendChild(tempInput); // 臨時加入 DOM 以觸發 click

    tempInput.onchange = (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData.optimizableCircleIdentifiers || !importedData.solutions || !Array.isArray(importedData.solutions)) {
              throw new Error("匯入的 JSON 格式無效：缺少 optimizableCircleIdentifiers 或 solutions 欄位，或者 solutions 不是一個陣列。");
            }

            const currentAppOptimizableCircles = gridCircles.filter(circle => circle.selected && !circle.locked && !circle.refMaster);

            if (importedData.optimizableCircleIdentifiers.length !== currentAppOptimizableCircles.length) {
              throw new Error(`路口數量不匹配：匯入檔案定義了 ${importedData.optimizableCircleIdentifiers.length} 個可優化路口，但當前路網有 ${currentAppOptimizableCircles.length} 個可優化路口。請檢查路網設計或選擇正確的 Pareto 檔案。`);
            }

            const importedIdMap = new Map(importedData.optimizableCircleIdentifiers.map((idc, i) => [`${idc.row}-${idc.col}`, i]));
            currentAppOptimizableCircles.forEach(appCircle => {
              if (!importedIdMap.has(`${appCircle.row}-${appCircle.col}`)) {
                throw new Error(`當前可優化路口 (${appCircle.row},${appCircle.col}, 名稱: ${appCircle.intersectionName || '未命名'}) 在匯入檔案的 optimizableCircleIdentifiers 中未找到。請確保路網中選定的路口與檔案匹配。`);
              }
            });

            const validatedSolutions = importedData.solutions.map((sol, solIndex) => {
              if (!sol.individualOffsets || !Array.isArray(sol.individualOffsets) || !sol.fitnessVector || !Array.isArray(sol.fitnessVector)) {
                throw new Error(`Pareto 解 ${solIndex + 1} 格式無效：缺少 individualOffsets 或 fitnessVector。`);
              }
              if (sol.individualOffsets.length !== importedData.optimizableCircleIdentifiers.length) {
                throw new Error(`Pareto 解 ${solIndex + 1} 的時差數量 (${sol.individualOffsets.length}) 與其 optimizableCircleIdentifiers 數量 (${importedData.optimizableCircleIdentifiers.length}) 不符。`);
              }

              const newIndividual = new Array(currentAppOptimizableCircles.length);
              currentAppOptimizableCircles.forEach((appCircle, appIndex) => {
                const importedCircleOriginalIndex = importedIdMap.get(`${appCircle.row}-${appCircle.col}`);
                newIndividual[appIndex] = sol.individualOffsets[importedCircleOriginalIndex];
              });

              if (newIndividual.some(offset => offset === undefined)) {
                throw new Error(`在處理 Pareto 解 ${solIndex + 1} 時，未能為所有當前可優化路口成功映射時差值。`);
              }

              return {
                individual: newIndividual,
                fitnessVector: sol.fitnessVector
              };
            });

            paretoSolutionsGlobal = validatedSolutions;
            window.lastOptimizableCirclesForParetoExport = [...currentAppOptimizableCircles];

            const currentCycleLengths = currentAppOptimizableCircles.map(circle => getCycleLength(circle));
            showParetoSelectionInterface(paretoSolutionsGlobal, currentAppOptimizableCircles, currentCycleLengths, originalIndexForContext);
            console.log("Pareto 解已匯入：", paretoSolutionsGlobal);
            alert("Pareto 解已成功匯入！");
          } catch (error) {
            console.error("匯入 Pareto 解失敗：", error);
            alert(`匯入失敗：${error.message}`);
          }
        };
        reader.readAsText(file);
      }
      // 清理臨時 input
      document.body.removeChild(tempInput);
    };

    // 觸發 file input 的點擊
    tempInput.click();
  };

  wrapper.appendChild(importLabel);
  paretoIODiv.appendChild(wrapper);
}

function validateRoadNetworkCompatibility(importedSolutions, gridCircles) {
  const expectedCircleCount = gridCircles.length;
  const expectedCircles = gridCircles.map(c => `${c.row}-${c.col}`).sort().join(",");

  for (const sol of importedSolutions) {
    if (!sol.individual || sol.individual.length !== expectedCircleCount) {
      return { valid: false, message: `路口數量不匹配（預期 ${expectedCircleCount} 個，實際 ${sol.individual.length} 個）` };
    }
    const circleIds = sol.individual.map(item => `${item.row}-${item.col}`).sort().join(",");
    if (circleIds !== expectedCircles) {
      return { valid: false, message: "路口位置不匹配" };
    }
  }
  return { valid: true };
}

// 右鍵選取功能
designCanvas.addEventListener("contextmenu", function(e) {
  e.preventDefault();
  const rect = designCanvas.getBoundingClientRect();
  const zoomFactor = getZoomFactor();
  const mx = (e.clientX - rect.left) / zoomFactor;
  const my = (e.clientY - rect.top) / zoomFactor;
  let hitCircle = null;

  gridCircles.forEach(circle => {
    let dx = circle.x - mx, dy = circle.y - my;
    if (Math.sqrt(dx * dx + dy * dy) < CIRCLE_RADIUS) {
      hitCircle = circle;
    }
  });

  if (hitCircle) {
    if (!hitCircle.selected) {
      hitCircle.selected = true;
    }
    selectedCircle = hitCircle;
    showCircleSettings(selectedCircle);
    drawDesignGrid();
  }

  const settingsPanel = document.getElementById("settingsPanel");
  const minimizedIcon = document.getElementById("minimizedIcon");
  const panelContent = document.getElementById("panelContent");
  restoreSettingsPanel(settingsPanel, minimizedIcon, panelContent, gcurrentX, gcurrentY);
});

function ParetoUI() {
  // originalIndexForContext 應為當前 UI 上的 selectedSpawnIndex
  const currentSelectedSpawnIdx = (typeof selectedSpawnIndex === 'number' && selectedSpawnIndex >=0) ? selectedSpawnIndex : 0;
  setupParetoIO(currentSelectedSpawnIdx);
}

function initializeAlgoParamsUI() {
    // SA Params
    document.getElementById("saInitialTemp").value = saInitialTemp;
    document.getElementById("saCoolingRate").value = saCoolingRate;
    document.getElementById("saMinTemp").value = saMinTemp;

    // NSGA-II for 2 Spawn Points Params
    document.getElementById("nsgaII2spPopSize").value = nsgaIIForTwoPopulationSize;
    document.getElementById("nsgaII2spMaxGen").value = nsgaIIForTwoMaxGenerations;

    // NSGA-II for Multi Spawn Points Params
    document.getElementById("nsgaIIMultiPopSize").value = nsgaIIPopulationSize;
    document.getElementById("nsgaIIMultiMaxGen").value = nsgaIIMaxGenerations;

    // Common GA Params
    document.getElementById("commonMutationRate").value = commonMutationRate;

    // Event listener for the apply button
    document.getElementById("applyAlgoParamsBtn").addEventListener("click", () => {
        // SA
        saInitialTemp = parseFloat(document.getElementById("saInitialTemp").value) || 1000;
        saCoolingRate = parseFloat(document.getElementById("saCoolingRate").value) || 0.95;
        saMinTemp = parseFloat(document.getElementById("saMinTemp").value) || 1;

        // NSGA-II 2SP
        nsgaIIForTwoPopulationSize = parseInt(document.getElementById("nsgaII2spPopSize").value) || 50;
        nsgaIIForTwoMaxGenerations = parseInt(document.getElementById("nsgaII2spMaxGen").value) || 5;

        // NSGA-II Multi
        nsgaIIPopulationSize = parseInt(document.getElementById("nsgaIIMultiPopSize").value) || 20;
        nsgaIIMaxGenerations = parseInt(document.getElementById("nsgaIIMultiMaxGen").value) || 10;

        // Common
        commonMutationRate = parseFloat(document.getElementById("commonMutationRate").value) || 0.1;

        // Basic validation/capping (optional, but good practice)
        saCoolingRate = Math.max(0.8, Math.min(0.99, saCoolingRate));
        commonMutationRate = Math.max(0, Math.min(1, commonMutationRate));

        alert("優化演算法參數已套用！");
        console.log("Updated SA Params:", { saInitialTemp, saCoolingRate, saMinTemp });
        console.log("Updated NSGA-II 2SP Params:", { nsgaIIForTwoPopulationSize, nsgaIIForTwoMaxGenerations });
        console.log("Updated NSGA-II Multi Params:", { nsgaIIPopulationSize, nsgaIIMaxGenerations });
        console.log("Updated Common Mutation Rate:", commonMutationRate);
    });
}

// 確保在 optimizeNSGAIIForTwoSpawnPoints 和 optimizeNSGAIIForTwoSpawnPoints3 (如果它們也產生 Pareto 解並調用 showParetoSelectionInterface)
// 的完成回調中，也加入 window.lastOptimizableCirclesForParetoExport = [...optimizableCirclesAtThatTime];
// 並正確傳遞 optimizableCircles 和 cycleLengths 給 showParetoSelectionInterface。
