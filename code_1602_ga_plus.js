function optimizeSA3() {
  const originalIndex = selectedSpawnIndex; // 記錄當前選擇
  showLoadingOverlay();
  updateLoadingText("正在執行時差優化 (第三代)...");
  updateLoadingProgress(0);

  setTimeout(() => {
    const optimizableCircles = gridCircles.filter(circle => circle.selected && !circle.locked);
    if (optimizableCircles.length === 0) {
      alert("沒有可優化的路口，請選擇未鎖定的路口！");
      hideLoadingOverlay();
      return null;
    }

    const cycleLengths = optimizableCircles.map(circle => getCycleLength(circle));
    let currentSolution, currentFitness;

    // 初始化解：優先使用 GA 結果，若無則隨機生成
    if (!gaBestIndividual || gaBestFitness === null) {
      console.log("gaBestIndividual 未定義，自行生成隨機初始解");
      currentSolution = cycleLengths.map(cycle => Math.floor(Math.random() * (cycle + 1)));
      currentFitness = calculateIntersectionRatioFitness(currentSolution, optimizableCircles);
    } else {
      currentSolution = gaBestIndividual.slice();
      currentFitness = calculateIntersectionRatioFitness(currentSolution, optimizableCircles);
    }

    const initialTemp = 3000;
    const coolingRate = 0.95;
    const minTemp = 1;

    let bestIndividual = currentSolution.slice();
    let bestFitness = currentFitness;
    const fitnessHistory = [];

    let temperature = initialTemp;
    let iteration = 0;
    const totalIterations = Math.ceil(Math.log(minTemp / initialTemp) / Math.log(coolingRate));

    // 計算適應度的輔助函數
    function calculateIntersectionRatioFitness(individual, circles) {
      applyOffsetsAndCompute(individual, circles, false); // 更新 offset 並計算路網狀態
      const ratioMatrix = computeRatioMatrix(fixedSimulationDuration);
      let totalIntersectionRatio = 0;
      ratioMatrix.forEach(spawn => {
        if (spawn.summary && spawn.summary.startIntersection === "summary") {
          //totalIntersectionRatio += spawn.summary.intersectionRatio;
		  totalIntersectionRatio += spawn.summary.distanceRatio		  
        }
      });
      return totalIntersectionRatio; // 返回所有 summary 的 intersectionRatio 總和
    }

    function runSAIteration() {
      if (temperature > minTemp) {
        iteration++;
        const progress = (Math.log(temperature / initialTemp) / Math.log(minTemp / initialTemp)) * 100;
        updateLoadingText(
          `時差優化中 - 進度: ${progress.toFixed(1)}%，目標值: ${(bestFitness * 100).toFixed(2)}%`
        );
        updateLoadingProgress(progress);
        selector.selectedIndex = originalIndex; // 恢復選擇

        // 生成鄰居解
        const newSolution = currentSolution.slice();
        const indexToChange = Math.floor(Math.random() * newSolution.length);
        const cycle = cycleLengths[indexToChange];
        newSolution[indexToChange] = Math.floor(Math.random() * (cycle + 1));

        // 計算新解的適應度
        const newFitness = calculateIntersectionRatioFitness(newSolution, optimizableCircles);
        const deltaFitness = newFitness - currentFitness;

        // 模擬退火接受機率
        if (deltaFitness > 0 || Math.random() < Math.exp(deltaFitness / temperature)) {
          currentSolution = newSolution;
          currentFitness = newFitness;
          if (currentFitness > bestFitness) {
            bestFitness = currentFitness;
            bestIndividual = currentSolution.slice();
            fitnessHistory.push(bestFitness);
            console.log(
              `SA3 溫度 ${temperature.toFixed(2)} - 最佳適應度: ${(bestFitness * 100).toFixed(2)}%`
            );
          }
        }

        temperature *= coolingRate;
        requestAnimationFrame(runSAIteration);
      } else {
        // 應用最佳解
        optimizableCircles.forEach((circle, index) => {
          circle.offset = Math.max(0, Math.min(Math.floor(bestIndividual[index]), cycleLengths[index]));
        });
        const finalResultJson = applyOffsetsAndCompute(bestIndividual, optimizableCircles, true);

        // 更新全局最佳解
        gaBestIndividual = bestIndividual.slice();
        gaBestFitness = bestFitness;

        drawDesignGrid();
        updateLoadingText("時差優化完成！");
        updateLoadingProgress(100);
        selector.selectedIndex = originalIndex; // 恢復選擇

        setTimeout(() => {
          hideLoadingOverlay();
          renderSpawnDataDisplay();
          console.log("SA3 精調完成，最佳時差配置：", bestIndividual);
          console.log("SA3 最終結果：", JSON.parse(finalResultJson));
          alert(`時差優化完成！最佳路口比例總和: ${(bestFitness * 100).toFixed(2)}%`);
          try {
            //drawFitnessChart(fitnessHistory);
          } catch (error) {
            console.error("Error occurred while drawing the fitness chart:", error);
          }
        }, 500);

        return finalResultJson;
      }
    }

    requestAnimationFrame(runSAIteration);
  }, 0);
}


function optimizeSA3_setting() {
  const originalIndex = selectedSpawnIndex; // 記錄當前選擇
  showLoadingOverlay();
  updateLoadingText("正在執行時差優化 (第三代)...");
  updateLoadingProgress(0);

  setTimeout(() => {
    const optimizableCircles = gridCircles.filter(circle => circle.selected && !circle.locked);
    if (optimizableCircles.length === 0) {
      alert("沒有可優化的路口，請選擇未鎖定的路口！");
      hideLoadingOverlay();
      return null;
    }

    const cycleLengths = optimizableCircles.map(circle => getCycleLength(circle));
    let currentSolution, currentFitness;

    // 初始化解：優先使用 GA 結果，若無則隨機生成
    if (!gaBestIndividual || gaBestFitness === null) {
      console.log("gaBestIndividual 未定義，自行生成隨機初始解");
      currentSolution = cycleLengths.map(cycle => Math.floor(Math.random() * (cycle + 1)));
      currentFitness = calculateIntersectionRatioFitness(currentSolution, optimizableCircles);
    } else {
      currentSolution = gaBestIndividual.slice();
      currentFitness = calculateIntersectionRatioFitness(currentSolution, optimizableCircles);
    }

    const initialTemp = 3000;
    const coolingRate = 0.95;
    const minTemp = 1;

    let bestIndividual = currentSolution.slice();
    let bestFitness = currentFitness;
    const fitnessHistory = [];

    let temperature = initialTemp;
    let iteration = 0;
    const totalIterations = Math.ceil(Math.log(minTemp / initialTemp) / Math.log(coolingRate));

    // 計算適應度的輔助函數
	function calculateIntersectionRatioFitness(individual, circles) {
	  applyOffsetsAndCompute(individual, circles, false); // 更新 offset 並計算路網狀態
	  const ratioMatrix = computeRatioMatrix(fixedSimulationDuration);
	  let totalIntersectionRatio = 0;

	  // 目標A：spawnIndex 0, startIntersection 4 的 intersectionRatio
	  const spawn0 = ratioMatrix.find(spawn => spawn.spawnIndex === 0);
	  if (spawn0 && spawn0.matrix) {
		const intersection4 = spawn0.matrix.find(item => item.startIntersection === 4);//西屯
		if (intersection4) {
		  totalIntersectionRatio += intersection4.intersectionRatio || 0;
		}
	  }

	  // 目標B：spawnIndex 1, startIntersection 6 的 intersectionRatio
	  const spawn1 = ratioMatrix.find(spawn => spawn.spawnIndex === 1);
	  if (spawn1 && spawn1.matrix) {
		const intersection6 = spawn1.matrix.find(item => item.startIntersection === 6);//西屯
		if (intersection6) {
		  totalIntersectionRatio += intersection6.intersectionRatio || 0;
		}
	  }

	  return totalIntersectionRatio; // 返回目標A + 目標B 的 intersectionRatio 總和
	}

    function runSAIteration() {
      if (temperature > minTemp) {
        iteration++;
        const progress = (Math.log(temperature / initialTemp) / Math.log(minTemp / initialTemp)) * 100;
        updateLoadingText(
          `時差優化中 - 進度: ${progress.toFixed(1)}%，目標值: ${(bestFitness * 100).toFixed(2)}%`
        );
        updateLoadingProgress(progress);
        selector.selectedIndex = originalIndex; // 恢復選擇

        // 生成鄰居解
        const newSolution = currentSolution.slice();
        const indexToChange = Math.floor(Math.random() * newSolution.length);
        const cycle = cycleLengths[indexToChange];
        newSolution[indexToChange] = Math.floor(Math.random() * (cycle + 1));

        // 計算新解的適應度
        const newFitness = calculateIntersectionRatioFitness(newSolution, optimizableCircles);
        const deltaFitness = newFitness - currentFitness;

        // 模擬退火接受機率
        if (deltaFitness > 0 || Math.random() < Math.exp(deltaFitness / temperature)) {
          currentSolution = newSolution;
          currentFitness = newFitness;
          if (currentFitness > bestFitness) {
            bestFitness = currentFitness;
            bestIndividual = currentSolution.slice();
            fitnessHistory.push(bestFitness);
            console.log(
              `SA3 溫度 ${temperature.toFixed(2)} - 最佳適應度: ${(bestFitness * 100).toFixed(2)}%`
            );
          }
        }

        temperature *= coolingRate;
        requestAnimationFrame(runSAIteration);
      } else {
        // 應用最佳解
        optimizableCircles.forEach((circle, index) => {
          circle.offset = Math.max(0, Math.min(Math.floor(bestIndividual[index]), cycleLengths[index]));
        });
        const finalResultJson = applyOffsetsAndCompute(bestIndividual, optimizableCircles, true);

        // 更新全局最佳解
        gaBestIndividual = bestIndividual.slice();
        gaBestFitness = bestFitness;

        drawDesignGrid();
        updateLoadingText("時差優化完成！");
        updateLoadingProgress(100);
        selector.selectedIndex = originalIndex; // 恢復選擇

        setTimeout(() => {
          hideLoadingOverlay();
          renderSpawnDataDisplay();
          console.log("SA3 精調完成，最佳時差配置：", bestIndividual);
          console.log("SA3 最終結果：", JSON.parse(finalResultJson));
          alert(`時差優化完成！最佳路口比例總和: ${(bestFitness * 100).toFixed(2)}%`);
          try {
            //drawFitnessChart(fitnessHistory);
          } catch (error) {
            console.error("Error occurred while drawing the fitness chart:", error);
          }
        }, 500);

        return finalResultJson;
      }
    }

    requestAnimationFrame(runSAIteration);
  }, 0);
}


function optimizeGA3() {
  const originalIndex = selectedSpawnIndex; // 記錄當前選擇
	
  // 立即显示加载提示
  showLoadingOverlay();
  updateLoadingText("正在準備時差優化...");
  updateLoadingProgress(0);

  const populationSize = 50;
  const generations = 10;
  const mutationRate = 0.1;
  const elitismCount = 2;

  const optimizableCircles = gridCircles.filter(circle => circle.selected && !circle.locked);
  if (optimizableCircles.length === 0) {
    alert("沒有可優化的路口，請選擇未鎖定的路口！");
    hideLoadingOverlay();
    return null;
  }

  const cycleLengths = optimizableCircles.map(circle => getCycleLength(circle));
  
  function createIndividual() {
    return cycleLengths.map(cycle => Math.floor(Math.random() * (cycle + 1)));
  }

  function select(population, fitnesses) {
    const totalFitness = fitnesses.reduce((sum, f) => sum + f, 0);
    const rand = Math.random() * totalFitness;
    let cumulative = 0;
    for (let i = 0; i < population.length; i++) {
      cumulative += fitnesses[i];
      if (cumulative >= rand) return population[i].slice();
    }
    return population[population.length - 1].slice();
  }

  function crossover(parent1, parent2) {
    const point = Math.floor(Math.random() * parent1.length);
    return [
      [...parent1.slice(0, point), ...parent2.slice(point)],
      [...parent2.slice(0, point), ...parent1.slice(point)]
    ];
  }

  function mutate(individual) {
    return individual.map((offset, index) => {
      if (Math.random() < mutationRate) {
        const cycle = cycleLengths[index];
        return Math.floor(Math.random() * (cycle + 1));
      }
      return offset;
    });
  }

  // 添加與 optimizeSA3 相同的適應度計算函數
  function calculateIntersectionRatioFitness(individual, circles) {
    applyOffsetsAndCompute(individual, circles, false); // 更新 offset 並計算路網狀態
    const ratioMatrix = computeRatioMatrix(fixedSimulationDuration);
    let totalIntersectionRatio = 0;
    ratioMatrix.forEach(spawn => {
      if (spawn.summary && spawn.summary.startIntersection === "summary") {
        totalIntersectionRatio += spawn.summary.distanceRatio;
      }
    });
    return totalIntersectionRatio; // 返回所有 summary 的 distanceRatio 總和
  }

  let population;
  let bestIndividual = null;
  let bestFitness = -Infinity;
  const fitnessHistory = [];
  let gen = 0;

  // 初始化函数，确保 UI 先渲染
  function initializeGA() {
    population = Array.from({ length: populationSize }, createIndividual);
    requestAnimationFrame(runGAIteration); // 初始化完成后开始迭代
  }

  function runGAIteration() {
    if (gen < generations) {
      const progress = ((gen + 1) / generations) * 100;

      // 修改為使用 calculateIntersectionRatioFitness
      const fitnesses = population.map(ind => calculateIntersectionRatioFitness(ind, optimizableCircles));
      const maxFitnessIndex = fitnesses.indexOf(Math.max(...fitnesses));
      if (fitnesses[maxFitnessIndex] > bestFitness) {
        bestFitness = fitnesses[maxFitnessIndex];
        bestIndividual = population[maxFitnessIndex].slice();
      }
      selector.selectedIndex = originalIndex; // 恢復選擇

      updateLoadingText(`時差優化中 - 進度: ${progress.toFixed(0)}%，目標值: ${(bestFitness * 100).toFixed(2)}%`);
      updateLoadingProgress(progress);	  

      fitnessHistory.push(bestFitness);
      console.log(`GA 第 ${gen + 1} 代 - 最佳適應度: ${(bestFitness * 100).toFixed(2)}%`);

      const newPopulation = [];
      const sortedIndices = fitnesses.map((f, i) => i).sort((a, b) => fitnesses[b] - fitnesses[a]);
      for (let i = 0; i < elitismCount && i < population.length; i++) {
        newPopulation.push(population[sortedIndices[i]].slice());
      }

      while (newPopulation.length < populationSize) {
        const parent1 = select(population, fitnesses);
        const parent2 = select(population, fitnesses);
        const [child1, child2] = crossover(parent1, parent2);
        newPopulation.push(mutate(child1));
        if (newPopulation.length < populationSize) newPopulation.push(mutate(child2));
      }

      population = newPopulation;
      gen++;
      requestAnimationFrame(runGAIteration);
    } else {
      gaBestIndividual = bestIndividual;
      gaBestFitness = bestFitness;
      optimizableCircles.forEach((circle, index) => {
        circle.offset = Math.max(0, Math.min(Math.floor(bestIndividual[index]), cycleLengths[index]));
      });
      const resultJson = applyOffsetsAndCompute(bestIndividual, optimizableCircles, true);
      drawDesignGrid();
      updateLoadingText("時差優化完成！");
      updateLoadingProgress(100);
      selector.selectedIndex = originalIndex; // 恢復選擇
	 
      setTimeout(() => {
        hideLoadingOverlay();
        renderSpawnDataDisplay();
        //drawFitnessChart(fitnessHistory);
        alert(`時差優化完成！最佳路口比例總和: ${(bestFitness * 100).toFixed(2)}%`);
      }, 500);
    }
  }

  // 使用 requestAnimationFrame 确保 UI 先更新再进行初始化
  requestAnimationFrame(initializeGA);
}

function optimizeGA3_setting() {
  const originalIndex = selectedSpawnIndex; // 記錄當前選擇
	
  // 立即显示加载提示
  showLoadingOverlay();
  updateLoadingText("正在準備時差優化...");
  updateLoadingProgress(0);

  const populationSize = 50;
  const generations = 10;
  const mutationRate = 0.1;
  const elitismCount = 2;

  const optimizableCircles = gridCircles.filter(circle => circle.selected && !circle.locked);
  if (optimizableCircles.length === 0) {
    alert("沒有可優化的路口，請選擇未鎖定的路口！");
    hideLoadingOverlay();
    return null;
  }

  const cycleLengths = optimizableCircles.map(circle => getCycleLength(circle));
  
  function createIndividual() {
    return cycleLengths.map(cycle => Math.floor(Math.random() * (cycle + 1)));
  }

  function select(population, fitnesses) {
    const totalFitness = fitnesses.reduce((sum, f) => sum + f, 0);
    const rand = Math.random() * totalFitness;
    let cumulative = 0;
    for (let i = 0; i < population.length; i++) {
      cumulative += fitnesses[i];
      if (cumulative >= rand) return population[i].slice();
    }
    return population[population.length - 1].slice();
  }

  function crossover(parent1, parent2) {
    const point = Math.floor(Math.random() * parent1.length);
    return [
      [...parent1.slice(0, point), ...parent2.slice(point)],
      [...parent2.slice(0, point), ...parent1.slice(point)]
    ];
  }

  function mutate(individual) {
    return individual.map((offset, index) => {
      if (Math.random() < mutationRate) {
        const cycle = cycleLengths[index];
        return Math.floor(Math.random() * (cycle + 1));
      }
      return offset;
    });
  }

  // 添加與 optimizeSA3 相同的適應度計算函數
	// 計算適應度的輔助函數
	function calculateIntersectionRatioFitness(individual, circles) {
	  applyOffsetsAndCompute(individual, circles, false); // 更新 offset 並計算路網狀態
	  const ratioMatrix = computeRatioMatrix(fixedSimulationDuration);
	  let totalIntersectionRatio = 0;

	  // 目標A：spawnIndex 0, startIntersection 4 的 intersectionRatio
	  const spawn0 = ratioMatrix.find(spawn => spawn.spawnIndex === 0);
	  if (spawn0 && spawn0.matrix) {
		const intersection4 = spawn0.matrix.find(item => item.startIntersection === 4);
		if (intersection4) {
		  totalIntersectionRatio += intersection4.intersectionRatio || 0;
		}
	  }

	  // 目標B：spawnIndex 1, startIntersection 6 的 intersectionRatio
	  const spawn1 = ratioMatrix.find(spawn => spawn.spawnIndex === 1);
	  if (spawn1 && spawn1.matrix) {
		const intersection6 = spawn1.matrix.find(item => item.startIntersection === 6);
		if (intersection6) {
		  totalIntersectionRatio += intersection6.intersectionRatio || 0;
		}
	  }

	  return totalIntersectionRatio; // 返回目標A + 目標B 的 intersectionRatio 總和
	}

  let population;
  let bestIndividual = null;
  let bestFitness = -Infinity;
  const fitnessHistory = [];
  let gen = 0;

  // 初始化函数，确保 UI 先渲染
  function initializeGA() {
    population = Array.from({ length: populationSize }, createIndividual);
    requestAnimationFrame(runGAIteration); // 初始化完成后开始迭代
  }

  function runGAIteration() {
    if (gen < generations) {
      const progress = ((gen + 1) / generations) * 100;

      // 修改為使用 calculateIntersectionRatioFitness
      const fitnesses = population.map(ind => calculateIntersectionRatioFitness(ind, optimizableCircles));
      const maxFitnessIndex = fitnesses.indexOf(Math.max(...fitnesses));
      if (fitnesses[maxFitnessIndex] > bestFitness) {
        bestFitness = fitnesses[maxFitnessIndex];
        bestIndividual = population[maxFitnessIndex].slice();
      }
      selector.selectedIndex = originalIndex; // 恢復選擇

      updateLoadingText(`時差優化中 - 進度: ${progress.toFixed(0)}%，目標值: ${(bestFitness * 100).toFixed(2)}%`);
      updateLoadingProgress(progress);	  

      fitnessHistory.push(bestFitness);
      console.log(`GA 第 ${gen + 1} 代 - 最佳適應度: ${(bestFitness * 100).toFixed(2)}%`);

      const newPopulation = [];
      const sortedIndices = fitnesses.map((f, i) => i).sort((a, b) => fitnesses[b] - fitnesses[a]);
      for (let i = 0; i < elitismCount && i < population.length; i++) {
        newPopulation.push(population[sortedIndices[i]].slice());
      }

      while (newPopulation.length < populationSize) {
        const parent1 = select(population, fitnesses);
        const parent2 = select(population, fitnesses);
        const [child1, child2] = crossover(parent1, parent2);
        newPopulation.push(mutate(child1));
        if (newPopulation.length < populationSize) newPopulation.push(mutate(child2));
      }

      population = newPopulation;
      gen++;
      requestAnimationFrame(runGAIteration);
    } else {
      gaBestIndividual = bestIndividual;
      gaBestFitness = bestFitness;
      optimizableCircles.forEach((circle, index) => {
        circle.offset = Math.max(0, Math.min(Math.floor(bestIndividual[index]), cycleLengths[index]));
      });
      const resultJson = applyOffsetsAndCompute(bestIndividual, optimizableCircles, true);
      drawDesignGrid();
      updateLoadingText("時差優化完成！");
      updateLoadingProgress(100);
      selector.selectedIndex = originalIndex; // 恢復選擇
	 
      setTimeout(() => {
        hideLoadingOverlay();
        renderSpawnDataDisplay();
        //drawFitnessChart(fitnessHistory);
        alert(`時差優化完成！最佳路口比例總和: ${(bestFitness * 100).toFixed(2)}%`);
      }, 500);
    }
  }

  // 使用 requestAnimationFrame 确保 UI 先更新再进行初始化
  requestAnimationFrame(initializeGA);
}


function optimizeNSGAIIForTwoSpawnPoints3() {
  const originalIndex = selectedSpawnIndex;
  showLoadingOverlay();
  selector.selectedIndex = originalIndex;
  updateLoadingText("正在執行 NSGA-II 多目標時差優化 (2 生成點)...");
  updateLoadingProgress(0);
  selector.selectedIndex = originalIndex;

  setTimeout(() => {
    // 修改篩選邏輯，排除已勾選引用主燈號的路口
    const optimizableCircles = gridCircles.filter(circle => 
      circle.selected && !circle.locked && !circle.refMaster
    );
    if (optimizableCircles.length === 0) {
      alert("沒有可優化的路口，請選擇未鎖定且未引用主燈號的路口！");
      hideLoadingOverlay();
      return null;
    }	

    if (spawnPointsList.length != 2) {
      alert("生成點數量不等於 2 個！");
      hideLoadingOverlay();
      return null;
    }

    const cycleLengths = optimizableCircles.map(circle => getCycleLength(circle)); // 例如 [20, 15, 10]
    const populationSize = 26;
    const maxGenerations = 10;
    let generation = 0;

    // 修改適應度計算函數，仿照 optimizeSA3 的 distanceRatio
    function calculateMultiObjectiveFitness(individual) {
      applyOffsetsAndCompute(individual, optimizableCircles, false); // 更新 offset 並計算路網狀態
      const ratioMatrix = computeRatioMatrix(fixedSimulationDuration);
      const distanceRatios = ratioMatrix.map(spawn => {
        if (spawn.summary && spawn.summary.startIntersection === "summary") {
          return spawn.summary.distanceRatio || 0;
        }
        return 0;
      });
      return [distanceRatios[0], distanceRatios[1]]; // 返回 [distanceRatio1, distanceRatio2]
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

    // 修改擁擠距離，加入比值平衡
    function calculateCrowdingDistance(front) {
      if (!front || front.length === 0) return [];
      const numObjectives = 2; // 只考慮 distanceRatio1, distanceRatio2
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

      // 加入比值平衡調整
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
        updateLoadingText(`NSGA-II 優化中 - 世代: ${generation}/${maxGenerations} - 進度: ${progress.toFixed(1)}%`);
        updateLoadingProgress(progress);
        selector.selectedIndex = originalIndex;

        const fronts = nonDominatedSort(population);
        const crowdingDistances = fronts.map(front => calculateCrowdingDistance(front)).flat();

        const offspring = [];
        while (offspring.length < populationSize) {
          const parent1 = tournamentSelection(population, fronts, crowdingDistances);
          const parent2 = tournamentSelection(population, fronts, crowdingDistances);
          const [child1, child2] = crossover(parent1, parent2);
          offspring.push(Math.random() < 0.1 ? mutate(child1) : child1);
          if (offspring.length < populationSize) offspring.push(Math.random() < 0.1 ? mutate(child2) : child2);
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

        // 最終篩選：優先比值接近 1 的解
        paretoSolutions = paretoSolutions
          .map(sol => ({
            ...sol,
            ratioDeviation: Math.abs(sol.fitnessVector[0] / sol.fitnessVector[1] - 1)
          }))
          .sort((a, b) => a.ratioDeviation - b.ratioDeviation)
          .slice(0, 10); // 取前 10 個

        paretoSolutionsGlobal = paretoSolutions;
        updateLoadingText("NSGA-II 優化完成，正在準備選擇介面...");
        updateLoadingProgress(100);
        selector.selectedIndex = originalIndex;

        setTimeout(() => {
          hideLoadingOverlay();
          showParetoSelectionInterface(paretoSolutionsGlobal, optimizableCircles, cycleLengths, originalIndex);
        }, 500);
      }
    }

    requestAnimationFrame(runNSGAIIIteration);
  }, 0);
}

function optimizeNSGAIIForTwoSpawnPoints3_setting() {
  const originalIndex = selectedSpawnIndex;
  showLoadingOverlay();
  selector.selectedIndex = originalIndex;
  updateLoadingText("正在執行 NSGA-II 多目標時差優化 (2 生成點)...");
  updateLoadingProgress(0);
  selector.selectedIndex = originalIndex;

  setTimeout(() => {
    // 修改篩選邏輯，排除已勾選引用主燈號的路口
    const optimizableCircles = gridCircles.filter(circle => 
      circle.selected && !circle.locked && !circle.refMaster
    );
    if (optimizableCircles.length === 0) {
      alert("沒有可優化的路口，請選擇未鎖定且未引用主燈號的路口！");
      hideLoadingOverlay();
      return null;
    }	

    if (spawnPointsList.length != 2) {
      alert("生成點數量不等於 2 個！");
      hideLoadingOverlay();
      return null;
    }

    const cycleLengths = optimizableCircles.map(circle => getCycleLength(circle)); // 例如 [20, 15, 10]
    const populationSize = 26;
    const maxGenerations = 10;
    let generation = 0;

	// 修改適應度計算函數，仿照 calculateIntersectionRatioFitness 的目標值
	function calculateMultiObjectiveFitness(individual) {
	  applyOffsetsAndCompute(individual, optimizableCircles, false); // 更新 offset 並計算路網狀態
	  const ratioMatrix = computeRatioMatrix(fixedSimulationDuration);
	  
	  // 目標A：spawnIndex 0, startIntersection 4 的 intersectionRatio
	  let spawn0IntersectionRatio = 0;
	  const spawn0 = ratioMatrix.find(spawn => spawn.spawnIndex === 0);
	  if (spawn0 && spawn0.matrix) {
		const intersection4 = spawn0.matrix.find(item => item.startIntersection === 4);
		if (intersection4) {
		  spawn0IntersectionRatio = intersection4.intersectionRatio || 0;
		}
	  }

	  // 目標B：spawnIndex 1, startIntersection 6 的 intersectionRatio
	  let spawn1IntersectionRatio = 0;
	  const spawn1 = ratioMatrix.find(spawn => spawn.spawnIndex === 1);
	  if (spawn1 && spawn1.matrix) {
		const intersection6 = spawn1.matrix.find(item => item.startIntersection === 5);  //華富
		if (intersection6) {
		  spawn1IntersectionRatio = intersection6.intersectionRatio || 0;
		}
	  }

	  return [spawn0IntersectionRatio, spawn1IntersectionRatio]; // 返回 [intersectionRatio_spawn0_intersection4, intersectionRatio_spawn1_intersection6]
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

    // 修改擁擠距離，加入比值平衡
    function calculateCrowdingDistance(front) {
      if (!front || front.length === 0) return [];
      const numObjectives = 2; // 只考慮 distanceRatio1, distanceRatio2
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

      // 加入比值平衡調整
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
        updateLoadingText(`NSGA-II 優化中 - 世代: ${generation}/${maxGenerations} - 進度: ${progress.toFixed(1)}%`);
        updateLoadingProgress(progress);
        selector.selectedIndex = originalIndex;

        const fronts = nonDominatedSort(population);
        const crowdingDistances = fronts.map(front => calculateCrowdingDistance(front)).flat();

        const offspring = [];
        while (offspring.length < populationSize) {
          const parent1 = tournamentSelection(population, fronts, crowdingDistances);
          const parent2 = tournamentSelection(population, fronts, crowdingDistances);
          const [child1, child2] = crossover(parent1, parent2);
          offspring.push(Math.random() < 0.1 ? mutate(child1) : child1);
          if (offspring.length < populationSize) offspring.push(Math.random() < 0.1 ? mutate(child2) : child2);
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

        // 最終篩選：優先比值接近 1 的解
        paretoSolutions = paretoSolutions
          .map(sol => ({
            ...sol,
            ratioDeviation: Math.abs(sol.fitnessVector[0] / sol.fitnessVector[1] - 1)
          }))
          .sort((a, b) => a.ratioDeviation - b.ratioDeviation)
          .slice(0, 10); // 取前 10 個

        paretoSolutionsGlobal = paretoSolutions;
        updateLoadingText("NSGA-II 優化完成，正在準備選擇介面...");
        updateLoadingProgress(100);
        selector.selectedIndex = originalIndex;

        setTimeout(() => {
          hideLoadingOverlay();
          showParetoSelectionInterface(paretoSolutionsGlobal, optimizableCircles, cycleLengths, originalIndex);
        }, 500);
      }
    }

    requestAnimationFrame(runNSGAIIIteration);
  }, 0);
}