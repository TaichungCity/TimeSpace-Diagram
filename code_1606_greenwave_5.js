function computeRatioMatrix(maxTime = 10) {
  const result = [];
  const step = 1;
  
  // 遍歷所有生成點
  spawnPointsList.forEach((spawn, spawnIndex) => {
    // 設置當前選擇的生成點索引
    selectedSpawnIndex = spawnIndex;
    const roads = continuousRoadsBySpawn[spawn.id];
    const direction = spawn.intersection.spawnPoint.direction;

    // 計算路口距離
    const distances = computeIntersectionDistances(roads);
    if (distances.length < 2) {
      console.warn(`生成點 ${spawnIndex}（${spawn.intersection.spawnPoint.spawnName || '未命名'}）路口數不足，跳過`);
      result.push({
        spawnIndex: spawnIndex,
        spawnName: spawn.intersection.spawnPoint.spawnName || `生成點_${spawnIndex}`,
        spawnDirection: direction,
        matrix: [],
        summary: { intersectionRatio: 0, distanceRatio: 0 }
      });
      return;
    }

    const ratioMatrix = [];
    let grandTotalIntersections = 0;
    let grandTotalDistance = 0;
    let grandTotalIdealIntersections = 0;
    let grandTotalIdealDistance = 0;
    const speed = greenWaveSpeed; // 使用全局綠波速度（m/s）

    // 為每個起點路口計算綠波數據
    for (let i = 0; i < distances.length - 1; i++) {
      const { codes, idealCodes } = computeGreenWaveCodesForStart(i, distances, direction, maxTime, step, speed);

      let totalIntersections = 0;
      let totalDistance = 0;
      let totalIdealIntersections = 0;
      let totalIdealDistance = 0;

      // 計算實際綠波通過的路口數和距離
      if (codes.length) {
        codes.forEach(code => {
          const [, startIdx, endIdx] = code.match(/g_(\d+)_(\d+)_[\d.]+/);
          const start = parseInt(startIdx);
          const end = parseInt(endIdx);
          totalIntersections += end - start;
          totalDistance += distances[end].distance - distances[start].distance;
        });
      }

      // 計算理想綠波通過的路口數和距離
      if (idealCodes.length) {
        idealCodes.forEach(code => {
          const [, startIdx, endIdx] = code.match(/G_(\d+)_(\d+)_[\d.]+/);
          const start = parseInt(startIdx);
          const end = parseInt(endIdx);
          totalIdealIntersections += end - start;
          totalIdealDistance += distances[end].distance - distances[start].distance;
        });
      }

      // 添加該起點路口的數據
      ratioMatrix.push({
        startIntersection: i,
        intersectionRatio: parseFloat((totalIdealIntersections > 0 ? totalIntersections / totalIdealIntersections : 0).toFixed(2)),
        distanceRatio: parseFloat((totalIdealDistance > 0 ? totalDistance / totalIdealDistance : 0).toFixed(2))
      });

      // 累加總計
      grandTotalIntersections += totalIntersections;
      grandTotalDistance += totalDistance;
      grandTotalIdealIntersections += totalIdealIntersections;
      grandTotalIdealDistance += totalIdealDistance;
    }

    // 添加總結數據
    const summary = {
      startIntersection: "summary",
      intersectionRatio: parseFloat((grandTotalIdealIntersections > 0 ? grandTotalIntersections / grandTotalIdealIntersections : 0).toFixed(2)),
      distanceRatio: parseFloat((grandTotalIdealDistance > 0 ? grandTotalDistance / grandTotalIdealDistance : 0).toFixed(2))
    };

    // 將該生成點的數據添加到結果中
    result.push({
      spawnIndex: spawnIndex,
      spawnName: spawn.intersection.spawnPoint.spawnName || `生成點_${spawnIndex}`,
      spawnDirection: direction,
      matrix: ratioMatrix,
      summary: summary
    });
  });

  return result;
}

function computeIntersectionDistances(roads) {
  const distances = [];
  let cumulativeDistance = 0;

  roads.forEach((road, index) => {
    const startIntersect = simIntersections.find(inter =>
      Math.abs(inter.position.x - road.start.x) < 5 &&
      Math.abs(inter.position.y - road.start.y) < 5
    );
    if (startIntersect) {
      distances.push({ id: startIntersect.id, distance: cumulativeDistance });
    }
    cumulativeDistance += road.distance / METER_TO_PIXEL;
    if (index === roads.length - 1) {
      const endIntersect = simIntersections.find(inter =>
        Math.abs(inter.position.x - road.end.x) < 5 &&
        Math.abs(inter.position.y - road.end.y) < 5
      );
      if (endIntersect) {
        distances.push({ id: endIntersect.id, distance: cumulativeDistance });
      }
    }
  });

  return distances;
}

function isGreenWave(startIdx, endIdx, startTime, distances, direction, speed) {
  for (let k = startIdx; k <= endIdx; k++) {
    const arrivalTime = startTime + (distances[k].distance - distances[startIdx].distance) / speed;
    const intersectId = distances[k].id;
    const states = trafficLightStates[intersectId] || [];
    if (!states.length) return false;

    let lightState = 'red';
    for (let s = 0; s < states.length - 1; s++) {
      if (arrivalTime >= states[s].time && arrivalTime < states[s + 1].time) {
        lightState = states[s].state[direction];
        break;
      }
    }
    if (arrivalTime >= states[states.length - 1].time) {
      lightState = states[states.length - 1].state[direction];
    }
    if (lightState !== 'green') return false;
  }
  return true;
}

function isIdealGreenWave(startIdx, startTime, distances, direction, speed) {
  const endIdx = distances.length - 1;
  const arrivalTime = startTime + (distances[endIdx].distance - distances[startIdx].distance) / speed;
  const intersectId = distances[endIdx].id;
  const states = trafficLightStates[intersectId] || [];
  if (!states.length) return false;

  let lightState = 'red';
  for (let s = 0; s < states.length - 1; s++) {
    if (arrivalTime >= states[s].time && arrivalTime < states[s + 1].time) {
      lightState = states[s].state[direction];
      break;
    }
  }
  if (arrivalTime >= states[states.length - 1].time) {
    lightState = states[states.length - 1].state[direction];
  }
  return lightState === 'green';
}

function computeGreenWaveCodesForStart(i, distances, direction, maxTime, step, speed) {
  const timeToMaxJ = {};
  const idealCodes = [];
  let t = 0;

  while (t < maxTime) {
    const timeKey = t.toFixed(1);
    let maxJ = i;

    for (let j = i + 1; j < distances.length; j++) {
      if (isGreenWave(i, j, t, distances, direction, speed)) {
        maxJ = j;
      }
    }
    if (maxJ > i) {
      timeToMaxJ[timeKey] = `g_${i}_${maxJ}_${timeKey}`;
    }

    const lastJ = distances.length - 1;
    if (lastJ > i && isIdealGreenWave(i, t, distances, direction, speed)) {
      idealCodes.push(`G_${i}_${lastJ}_${timeKey}`);
    }

    t += step;
  }

  const codes = Object.values(timeToMaxJ).sort((a, b) => parseFloat(a.split('_')[3]) - parseFloat(b.split('_')[3]));
  idealCodes.sort((a, b) => parseFloat(a.split('_')[3]) - parseFloat(b.split('_')[3]));

  return { codes, idealCodes };
}

document.getElementById("someButton").addEventListener("click", function() {
  // 確保交通燈狀態已預計算
  //precomputeTrafficLightStates();

  // 計算所有生成點的矩陣
  const matrixArray = computeRatioMatrix(fixedSimulationDuration);
  console.log(JSON.stringify(matrixArray, null, 2));

  // 格式化並顯示結果
  matrixArray.forEach(matrix => {
    console.log(`生成點 ${matrix.spawnName} (方向: ${matrix.spawnDirection}):`);
    console.log("矩陣:", JSON.stringify(matrix.matrix, null, 2));
    console.log("總結:", JSON.stringify(matrix.summary, null, 2));
  });

  // 可選：將結果顯示在頁面上
 // displayMatrixResults(matrixArray);
});