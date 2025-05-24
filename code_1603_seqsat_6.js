document.getElementById("statsBtn_segment").addEventListener("click", function() {
  if (Object.keys(vehicleTrajectories).length === 0) {
    alert("目前沒有軌跡數據可統計！");
    return;
  }

  const statsBySegment = calculateStatsBySegment();
  displaySegmentStats(statsBySegment);
});

document.getElementById("statsBtn").addEventListener("click", function() {
  if (Object.keys(vehicleTrajectories).length === 0) {
    alert("目前沒有軌跡數據可統計！");
    return;
  }

  const statsBySpawn = calculateStatsBySpawn();
  displayStats(statsBySpawn);
});

function calculateStatsBySegment() {
  const statsBySpawn = {};

  spawnPointsList.forEach((spawn, spawnIndex) => {
    const spawnId = spawn.id;
    const roads = continuousRoadsBySpawn[spawnId];
    if (!roads || roads.length === 0) return;

    const segments = [];
    let cumulativeDistance = 0;
    roads.forEach((road, index) => {
      const startIntersect = simIntersections.find(inter =>
        Math.abs(inter.position.x - road.start.x) < 5 &&
        Math.abs(inter.position.y - road.start.y) < 5
      );
      const endIntersect = simIntersections.find(inter =>
        Math.abs(inter.position.x - road.end.x) < 5 &&
        Math.abs(inter.position.y - road.end.y) < 5
      );
      const segmentDistance = road.distance;

      if (startIntersect && endIntersect) {
        segments.push({
          startId: startIntersect.id,
          endId: endIntersect.id,
          startDistance: cumulativeDistance,
          endDistance: cumulativeDistance + segmentDistance,
          distance: segmentDistance
        });
      }
      cumulativeDistance += segmentDistance;
    });

    const spawnKey = `生成點 ${spawnIndex + 1} (${spawn.intersection.spawnPoint.spawnName || spawnId})`;
    statsBySpawn[spawnKey] = {
      segments: segments.map(seg => ({
        startId: seg.startId,
        endId: seg.endId,
        totalSpeed: 0,
        speedCount: 0,
        totalMovingSpeed: 0,
        movingSpeedCount: 0,
        totalStops: 0,
        totalStopTime: 0,
        vehicleCount: 0,
        stoppedVehicleCount: 0
      })),
      vehicles: new Set()
    };

    for (let vehId in vehicleTrajectories) {
      const trajectory = vehicleTrajectories[vehId];
      if (trajectory.length < 2 || trajectory[0].spawnId !== spawnId) continue;

      statsBySpawn[spawnKey].vehicles.add(vehId);
      let segmentIndex = 0;
      let wasStopped = false;
      let stopStartTime = null;
      let hasStoppedInSegment = [];

      for (let i = 1; i < trajectory.length; i++) {
        const prev = trajectory[i - 1];
        const curr = trajectory[i];

        if (prev.position <= 0 || curr.position <= 0 || curr.time - prev.time <= 0) continue;

        while (segmentIndex < segments.length - 1 &&
               curr.position > segments[segmentIndex].endDistance) {
          segmentIndex++;
        }
        if (curr.position < segments[segmentIndex].startDistance) continue;

        const segment = statsBySpawn[spawnKey].segments[segmentIndex];
        const distance = curr.position - prev.position;
        const timeDiff = curr.time - prev.time;
        const speedMs = distance / timeDiff;
        const speedKmh = speedMs * 3.6;

        segment.totalSpeed += speedKmh;
        segment.speedCount += 1;

        if (speedMs > 0) {
          segment.totalMovingSpeed += speedKmh;
          segment.movingSpeedCount += 1;
        }

        if (speedMs === 0) {
          if (!wasStopped) {
            segment.totalStops += 1;
            stopStartTime = prev.time;
            hasStoppedInSegment[segmentIndex] = true;
          }
          wasStopped = true;
        } else {
          if (wasStopped && stopStartTime !== null) {
            segment.totalStopTime += curr.time - stopStartTime;
          }
          wasStopped = false;
          stopStartTime = null;
        }
      }

      if (wasStopped && stopStartTime !== null) {
        const lastSegment = statsBySpawn[spawnKey].segments[segmentIndex];
        lastSegment.totalStopTime += trajectory[trajectory.length - 1].time - stopStartTime;
        hasStoppedInSegment[segmentIndex] = true;
      }

      hasStoppedInSegment.forEach((hasStopped, idx) => {
        if (hasStopped && idx < statsBySpawn[spawnKey].segments.length) {
          statsBySpawn[spawnKey].segments[idx].stoppedVehicleCount += 1;
        }
      });
    }

    statsBySpawn[spawnKey].segments.forEach(segment => {
      segment.vehicleCount = statsBySpawn[spawnKey].vehicles.size;
      segment.averageSpeed = segment.speedCount > 0 ? segment.totalSpeed / segment.speedCount : 0;
      segment.averageMovingSpeed = segment.movingSpeedCount > 0 ? segment.totalMovingSpeed / segment.movingSpeedCount : 0;
      segment.averageStops = segment.vehicleCount > 0 ? segment.totalStops / segment.vehicleCount : 0;
      segment.averageStopTime = segment.vehicleCount > 0 ? segment.totalStopTime / segment.vehicleCount : 0;
      segment.averageStoppedVehicleStopTime = segment.stoppedVehicleCount > 0 ? segment.totalStopTime / segment.stoppedVehicleCount : 0;
    });
  });

  return statsBySpawn;
}

function displaySegmentStats(statsBySpawn) {
  const statsDiv = document.getElementById("speedStats");
  let html = "<h3>各生成點路段統計</h3>";

  for (let spawnKey in statsBySpawn) {
    const spawnStats = statsBySpawn[spawnKey];

    // 獲取路口名稱
    let intersectionNames = spawnStats.segments.map((segment, index) => {
      const startIntersect = simIntersections.find(inter => inter.id === segment.startId);
      const endIntersect = simIntersections.find(inter => inter.id === segment.endId);
      const startName = startIntersect && startIntersect.intersectionName?.trim()
        ? startIntersect.intersectionName
        : startIntersect ? `(${segment.startId.replace('intersect_', '').replace('_', ',')})` : segment.startId;
      const endName = endIntersect && endIntersect.intersectionName?.trim()
        ? endIntersect.intersectionName
        : endIntersect ? `(${segment.endId.replace('intersect_', '').replace('_', ',')})` : segment.endId;
      return `${startName} 到 ${endName}`;
    });

    // 指標名稱
    const metrics = [
      { key: "averageSpeed", name: "總平均速度 (km/h)" },
      { key: "averageMovingSpeed", name: "行進中平均速度 (km/h)" },
      { key: "averageStops", name: "平均停等次數 (次)" },
      { key: "averageStopTime", name: "平均停等秒數 (秒)" },
      { key: "averageStoppedVehicleStopTime", name: "平均有停等車輛停等秒數 (秒)" }
    ];

    // 創建表格
    html += `<h4>${spawnKey}</h4>`;
    html += `<table border="1" style="border-collapse: collapse; margin-bottom: 20px; width: 100%; max-width: 800px;">`;
    html += `<thead><tr><th>指標</th>`;
    intersectionNames.forEach((name, index) => {
      html += `<th>路段 ${index + 1}<br>(${name})</th>`;
    });
    html += `</tr></thead><tbody>`;

    metrics.forEach(metric => {
      html += `<tr><td>${metric.name}</td>`;
      spawnStats.segments.forEach(segment => {
        const value = segment[metric.key].toFixed(2);
        html += `<td>${value}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
  }

  if (Object.keys(statsBySpawn).length === 0) {
    html += "<p>無有效統計數據</p>";
  }

  statsDiv.innerHTML = html;
}

function calculateStatsBySpawn() {
  const statsBySpawn = {};
  const selector = document.getElementById("spawnPointSelector");
  const options = Array.from(selector.options);

  for (let vehId in vehicleTrajectories) {
    const trajectory = vehicleTrajectories[vehId];
    if (trajectory.length < 2) continue;

    const spawnId = trajectory[0].spawnId;
    const spawnPoint = spawnPointsList.find(sp => sp.id === spawnId);

    let key;
    if (!spawnPoint) {
      console.warn(`找不到 spawnId 為 ${spawnId} 的生成點，使用 spawnId 作為備用名稱`);
      key = `${spawnId} (未知方向)`;
    } else {
      const option = options.find(opt => opt.value === spawnPointsList.indexOf(spawnPoint).toString());
      key = option ? option.textContent : `${spawnPoint.name || "未知路口"} (${spawnPoint.direction || "未知方向"})`;
    }

    if (!statsBySpawn[key]) {
      statsBySpawn[key] = {
        totalSpeed: 0,
        speedCount: 0,
        totalMovingSpeed: 0,
        movingSpeedCount: 0,
        totalStops: 0,
        totalStopTime: 0,
        vehicleCount: 0
      };
    }

    let wasStopped = false;
    let stopStartTime = null;
    statsBySpawn[key].vehicleCount += 1;

    for (let i = 1; i < trajectory.length; i++) {
      const prev = trajectory[i - 1];
      const curr = trajectory[i];

      if (prev.position <= 0 || curr.position <= 0) continue;

      const distance = curr.position - prev.position;
      const timeDiff = curr.time - prev.time;
      if (timeDiff <= 0) continue;

      const speedMs = distance / timeDiff;
      const speedKmh = speedMs * 3.6;

      statsBySpawn[key].totalSpeed += speedKmh;
      statsBySpawn[key].speedCount += 1;

      if (speedMs > 0) {
        statsBySpawn[key].totalMovingSpeed += speedKmh;
        statsBySpawn[key].movingSpeedCount += 1;
      }

      if (speedMs === 0) {
        if (!wasStopped) {
          statsBySpawn[key].totalStops += 1;
          stopStartTime = prev.time;
        }
        wasStopped = true;
      } else {
        if (wasStopped) {
          const stopEndTime = curr.time;
          statsBySpawn[key].totalStopTime += stopEndTime - stopStartTime;
        }
        wasStopped = false;
        stopStartTime = null;
      }
    }

    if (wasStopped && stopStartTime !== null) {
      const stopEndTime = trajectory[trajectory.length - 1].time;
      statsBySpawn[key].totalStopTime += stopEndTime - stopStartTime;
    }
  }

  for (let key in statsBySpawn) {
    if (statsBySpawn[key].speedCount > 0) {
      statsBySpawn[key].averageSpeed = statsBySpawn[key].totalSpeed / statsBySpawn[key].speedCount;
    } else {
      statsBySpawn[key].averageSpeed = 0;
    }
    if (statsBySpawn[key].movingSpeedCount > 0) {
      statsBySpawn[key].averageMovingSpeed = statsBySpawn[key].totalMovingSpeed / statsBySpawn[key].movingSpeedCount;
    } else {
      statsBySpawn[key].averageMovingSpeed = 0;
    }
    if (statsBySpawn[key].vehicleCount > 0) {
      statsBySpawn[key].averageStops = statsBySpawn[key].totalStops / statsBySpawn[key].vehicleCount;
      statsBySpawn[key].averageStopTime = statsBySpawn[key].totalStopTime / statsBySpawn[key].vehicleCount;
    } else {
      statsBySpawn[key].averageStops = 0;
      statsBySpawn[key].averageStopTime = 0;
    }
  }

  return statsBySpawn;
}

function displayStats(statsBySpawn) {
  const statsDiv = document.getElementById("speedStats");
  let html = "<h3>各生成點統計</h3>";

  // 指標名稱
  const metrics = [
    { key: "averageSpeed", name: "總平均速度 (km/h)" },
    { key: "averageMovingSpeed", name: "行進中平均速度 (km/h)" },
    { key: "averageStops", name: "平均停等次數 (次)" },
    { key: "averageStopTime", name: "平均停等秒數 (秒)" }
  ];

  // 創建表格
  html += `<table border="1" style="border-collapse: collapse; margin-bottom: 20px; width: 100%; max-width: 800px;">`;
  html += `<thead><tr><th>生成點</th>`;
  metrics.forEach(metric => {
    html += `<th>${metric.name}</th>`;
  });
  html += `</tr></thead><tbody>`;

  for (let key in statsBySpawn) {
    html += `<tr><td>${key}</td>`;
    metrics.forEach(metric => {
      const value = statsBySpawn[key][metric.key].toFixed(2);
      html += `<td>${value}</td>`;
    });
    html += `</tr>`;
  }

  html += `</tbody></table>`;

  if (Object.keys(statsBySpawn).length === 0) {
    html += "<p>無有效統計數據</p>";
  }

  statsDiv.innerHTML = html;
}


