//import classifyPoint from "./robust-pnp";
import makeHull from "./convexhull";
import { FIZZSCAN } from "./FIZZSCAN";
//import Voronoi from "./rhill-voronoi-core";
//import polygonClipping from 'polygon-clipping'

export { generateClusterAnalysis, type clusterObject, type coord }


function generateClusterAnalysis(data: coord[], showForcing: boolean, labels?: any[]) {
    //data.sort();
    const dataLength: number = data.length

    if (dataLength == 0) {
        throw new Error("Error: Given data has zero length")
    }
    const factorizedLabels: any[] = [];
    let labelPairs: Array<LabelFactorPair> = []
    let uniqueLabels: Array<any> = []
    if (labels != undefined) {
        if (dataLength != labels.length) {
            throw new Error("Error: Given labels do not match length of data")
        }
        uniqueLabels = [...new Set(labels.flat())]
        for (let i = 0; i < uniqueLabels.length; i++) {
            labelPairs.push({ label: uniqueLabels[i], factor: i })
        }
        for (let i = 0; i < labels.length; i++) {
            factorizedLabels.push(uniqueLabels.indexOf(labels[i]));
        }
    }
    const minPts: number = 4;
    const epsilonParameter = 2;
    const dataArray: Array<Pair> = [];
    for (let i = 0; i < dataLength; i++) {
        dataArray.push([Number(data[i]["x"]), Number(data[i]["y"])])
    }

    //distAvg averges out the nearest neighbor distances over each point in the set
    const distAvg: Array<number> = [];
    const distanceStorage: Array<Array<number>> = [];

    for (let i = 0; i < dataLength; i++) {
        distanceStorage.push(nNDistancesSpecial(dataArray, i, minPts))
    }

    for (let i = 0; i < dataLength; i++) {
        let sum: number = 0;
        for (let j = 0; j < dataLength; j++) {
            sum += distanceStorage[j][i];
        }
        distAvg.push(sum / dataLength);
    }
    const fizzscan = new FIZZSCAN(dataArray, epsilonParameter * distAvg[minPts], minPts, showForcing);
    let clusters = fizzscan.clusters
    let centroids = fizzscan.clusterCentroids;
    //let noise = fizzscan.noise;
    let noiseAssigned = fizzscan.noiseAssigned
    if (labels != undefined) {
        clusters = [];
        for (let i = 0; i < uniqueLabels.length; i++) {
            clusters.push([])
        }
        for (let i = 0; i < dataArray.length; i++) {
            let pointLabel = factorizedLabels[i]
            clusters[pointLabel].push(i)
        }
        centroids = [];
        for (let i = 0; i < clusters.length; i++) {
            let clusterData: Array<Pair> = [];
            for (let pointId of clusters[i]) {
                clusterData.push(dataArray[pointId])
            }
            centroids.push(getCentroid(clusterData));
        }
        //noise = [];
        noiseAssigned = [];
    }

    const masterArray: Array<clusterObject> = [];
    //const palette: Array<string> = ["red", "orange", "yellow", "green", "blue", "cyan", "darkblue", "pink", "darkmagenta", "chocolate", "dodgerblue", "gold", "firebrick",
    //     "lawngreen", "red", "orange", "yellow", "green", "blue", "cyan", "darkblue", "pink", "darkmagenta", "chocolate", "dodgerblue", "gold", "firebrick", "lawngreen"];
    const clusterRegions: Array<number> = getRegion(centroids);
    const clusterRegionsJudged: Array<string> = judgeRegion(clusterRegions);
    const xArray: Array<number> = [];
    const yArray: Array<number> = [];
    for (let i = 0; i < dataLength; i++) {
        xArray.push(dataArray[i][0]);
        yArray.push(dataArray[i][1]);
    }
    const yMaxGlobal: number = Math.max(...yArray);
    const xMaxGlobal: number = Math.max(...xArray);
    const yMinGlobal: number = Math.min(...yArray);
    const xMinGlobal: number = Math.min(...xArray);
    let i: number = 0;

    //Forms objects out of clusters, assigns properties, then adds them to a master array
    for (let cluster of clusters) {
        const clusterObject: clusterObject = {
            area: 0,
            centroid: [],
            dataPoints: [],
            dataPointIDs: [],
            outliers: [],
            outlierIDs: [],
            density: 0,
            densityRank: 0,
            hasSignificantHole: false,
            holes: [],
            hull: [],
            hullIDs: [],
            hullSimplified: [],
            id: 0,
            perimeter: 0,
            region: 0,
            regionDesc: "",
            relations: [{
                angle: 0,
                cardDirection: "",
                distance: 0,
                id: 0,
                isNeighbor: false
            }],
            shape: { description: "" },
            xMin: 0,
            xMax: 0,
            yMin: 0,
            yMax: 0
        };
        const clusterData: Array<Pair> = [];
        for (let point of cluster) {
            clusterData.push(dataArray[point]);
        }

        if (labels) {
            clusterObject.label = uniqueLabels[i]
        }

        clusterObject.dataPoints = clusterData;
        clusterObject.dataPointIDs = cluster;
        let xMin: number = clusterData[0][0];
        let xMax: number = clusterData[0][0];
        let yMin: number = clusterData[0][1];
        let yMax: number = clusterData[0][1];
        for (let point of clusterData) {
            if (point[0] < xMin) {
                xMin = point[0];
            }
            if (point[0] > xMax) {
                xMax = point[0];
            }
            if (point[1] < yMin) {
                yMin = point[1];
            }
            if (point[1] > yMax) {
                yMax = point[1];
            }
        }
        clusterObject.xMin = xMin;
        clusterObject.xMax = xMax;
        clusterObject.yMin = yMin;
        clusterObject.yMax = yMax;
        clusterObject.centroid = centroids[i];


        clusterObject.id = i;

        clusterObject.region = clusterRegions[i];
        clusterObject.regionDesc = clusterRegionsJudged[i];


        const hull: Array<coord> = makeHull(coordinate(clusterData));
        clusterObject.hull = hull;

        for (let point of hull) {
            const id = dataArray.findIndex((e) => { return e[0] == point.x && e[1] == point.y })
            clusterObject.hullIDs.push(id);
        }

        const hullSimplified: Array<coord> = simplifyHull(hull);
        clusterObject.hullSimplified = hullSimplified;

        const area: number = shoelace(hull);
        clusterObject.area = area;

        const peri: number = perimeter(hull)
        clusterObject.perimeter = peri;


        const shape: { description: string } = judgeShape(clusterObject);
        clusterObject.shape = shape;
        //console.log(`The shape of the data is ${shape.description}`)

        const density: number = cluster.length / area;
        clusterObject.density = density;

        clusterObject.relations = [];
        const closest: Array<number> = nNIndices(centroids, i);
        const distances: Array<number> = nNDistances(centroids, i)

        for (let j = 0; j < clusters.length; j++) {
            const angle: number = getAngle(centroids[i], centroids[closest[j]]);
            const card: string = judgeAngle(centroids[i], centroids[closest[j]]);
            clusterObject.relations.push({
                "id": closest[j],
                "distance": distances[j],
                "angle": angle,
                "cardDirection": card
            })
        }

        //clusterObject.holes = findHoles(clusterObject);

        const holeParameter = .2;
        const largestHoleImportanceScore = clusterObject.holes[0][2]
        if (largestHoleImportanceScore > holeParameter) {
            clusterObject.hasSignificantHole = true;
        }
        else {
            clusterObject.hasSignificantHole = false;
        }


        masterArray.push(clusterObject);
        i++;
    }
    //Adds noise point IDs to each cluster in masterArray
    for (let pair of noiseAssigned) {
        masterArray[pair[1]].outliers.push(dataArray[pair[0]])
        masterArray[pair[1]].outlierIDs.push(pair[0])
    }
    //Adds density rankings for each cluster to masterArray
    const masterArrayClone: Array<clusterObject> = JSON.parse(JSON.stringify(masterArray));
    const densitySorted: Array<clusterObject> = masterArrayClone.sort((a, b) => {
        return a.density - b.density;
    })

    const densityIDs: Array<number> = [];
    for (let cluster of densitySorted) {
        densityIDs.push(cluster.id);
    }
    for (let cluster of masterArray) {
        cluster.densityRank = densityIDs.indexOf(cluster.id);
    }



    //Designates "neighbors" of each cluster and adds to masterArray
    i = 0;
    const neighborParameter: number = 1.2
    for (let cluster of centroids) {
        let j: number = 0;
        for (let target of centroids) {
            let cloneCentroids: Array<Pair> = [];
            if (i == j) {
                //Clusters are 'neighbors' of themselves
                masterArray[i].relations[0].isNeighbor = true;
                j++;
            }
            else {
                //Calculates the distance taken from the start to any branch that is closer than the target. If the smallest distance
                //from start-branch-target is less than neighborParameter times the direct distance, start and target are neighbors.
                if (i < j) {
                    cloneCentroids = [...centroids.slice(0, i), ...centroids.slice(i + 1)];
                    cloneCentroids.splice(j - 1, 1);
                }
                if (i > j) {
                    cloneCentroids = [...centroids.slice(0, j), ...centroids.slice(j + 1)];
                    cloneCentroids.splice(i - 1, 1);
                }

                const directDistance: number = euclidDistance(cluster, target);
                const branchDistances: Array<number> = [];
                for (let branch of cloneCentroids) {
                    if (euclidDistance(cluster, branch) < euclidDistance(cluster, target)) {
                        branchDistances.push(euclidDistance(cluster, branch) + euclidDistance(branch, target));
                    }
                }
                let targetRelation: relation = {
                    angle: 0,
                    cardDirection: "",
                    distance: 0,
                    id: 0,
                    isNeighbor: false
                };
                for (let relation of masterArray[i].relations) {
                    if (relation.id == j) {
                        targetRelation = relation;
                    }
                }
                if (Math.min(...branchDistances) < neighborParameter * directDistance) {
                    masterArray[i].relations[masterArray[i].relations.indexOf(targetRelation)].isNeighbor = false;
                }
                else {
                    masterArray[i].relations[masterArray[i].relations.indexOf(targetRelation)].isNeighbor = true;
                }
                j++;
            }
        }
        i++;
    }

    //Calculates overlap between clusters and adds to masterArray
    /*
    for (let clusterId = 0; clusterId < masterArray.length; clusterId++) {
        let cluster: clusterObject = masterArray[clusterId];
        for (let targetId = 0; targetId < masterArray.length; targetId++) {
            let pointer = 0;
            for (let relationID = 0; relationID < masterArray[clusterId].relations.length; relationID++) {
                let relation = masterArray[clusterId].relations[relationID]
                if (relation.id == Number(targetId)) {
                    pointer = Number(relationID)
                }
            }
            if (clusterId == targetId) {
                masterArray[clusterId].relations[pointer].overlap = 1;
            }
            else {
                let target: clusterObject = masterArray[targetId];
                let overlap = polygonClipping.intersection([deCoordinate(cluster.hull)], [deCoordinate(target.hull)]) as unknown as Array<Array<Array<Pair>>>;
                if (overlap.length > 0) {
                    let overlapPercentage = shoelace(coordinate(overlap[0][0])) / cluster.area;
                    masterArray[clusterId].relations[pointer].overlap = overlapPercentage;
                    masterArray[clusterId].relations[pointer].sharedPts = []
                    for (let point of cluster.dataPoints) {
                        let epsilon = 10 ** (Math.log10(Math.max((cluster.xMax - cluster.xMin), (cluster.yMax - cluster.yMin))) - 4)
                        if (classifyPoint(deCoordinate(target.hull), point, epsilon) < 1) {
                            masterArray[clusterId].relations[pointer].sharedPts!.push(point);
                        }
                    }
                    masterArray[clusterId].relations[pointer].percentPtsShared = masterArray[clusterId].relations[pointer].sharedPts!.length / masterArray[clusterId].dataPoints.length
                }
                else {
                    masterArray[clusterId].relations[pointer].overlap = 0;
                }
            }
        }
    }
*/

    function judgeShape(cluster: clusterObject): { description: string, radius?: number, averageSideLength?: number, slope?: number } {
        //Judges the 'shape' of the convex hull of a cluster of data.
        const data = cluster.dataPoints
        const h: Array<coord> = makeHull(coordinate(data));
        const flat: number = flatness(h);
        if (flat > .92) {
            //High flatness is categorized as roughly circular
            return {
                description: "roughly circular",
                radius: Math.sqrt(shoelace(h) / Math.PI)
            };
        }
        else if (flat > .7) {
            const simple: Array<Pair> = deCoordinate(simplifyHull(h));
            const sides: number = simple.length;
            switch (true) {
                case sides == 3:
                    return {
                        description: "triangular",
                        averageSideLength: (euclidDistance(simple[0], simple[1]) + euclidDistance(simple[1], simple[2]) + euclidDistance(simple[2], simple[0])) / 3
                    };
                case sides == 4:
                    const angle1: number = getAngle(simple[0], simple[1]);
                    const angle2: number = getAngle(simple[1], simple[2]);
                    const angle3: number = getAngle(simple[2], simple[3]);
                    const angle4: number = getAngle(simple[3], simple[0]);
                    const difference1: number = angle2 - angle1;
                    const difference2: number = angle3 - angle2;
                    const difference3: number = angle4 - angle3;
                    const difference4: number = angle1 - angle4;
                    if ((Math.abs(((difference1 + 720) % 360) - 270) < 15)
                        && (Math.abs(((difference2 + 720) % 360) - 270) < 15)
                        && (Math.abs(((difference3 + 720) % 360) - 270) < 15)
                        && (Math.abs(((difference4 + 720) % 360) - 270) < 15)) {
                        const distance1: number = euclidDistance(simple[0], simple[1]);
                        const distance2: number = euclidDistance(simple[1], simple[2]);
                        const distance3: number = euclidDistance(simple[2], simple[3]);
                        const distance4: number = euclidDistance(simple[3], simple[0]);
                        const average = (distance1 + distance2 + distance3 + distance4) / 4;
                        if ((average * .91 < distance1 && distance1 < average * 1.1)
                            && (average * .91 < distance2 && distance2 < average * 1.1)
                            && (average * .91 < distance3 && distance3 < average * 1.1)
                            && (average * .91 < distance4 && distance4 < average * 1.1)) {
                            if ((((angle1 % 90 + angle2 % 90 + angle3 % 90 + angle4 % 90) / 4) > 25)
                                && (((angle1 % 90 + angle2 % 90 + angle3 % 90 + angle4 % 90) / 4) < 65)) {
                                return {
                                    description: "diamond",
                                    averageSideLength: average
                                };
                            }
                            else {
                                return {
                                    description: "square",
                                    averageSideLength: average
                                };
                            }
                        }
                        else {
                            return { description: "rectangular" };
                        }
                    }
                    else if (Math.abs((difference1 + 720) % 360 - (difference3 + 720) % 360) < 20
                        && Math.abs((difference2 + 720) % 360 - (difference4 + 720) % 360) < 20) {
                        return { description: "parallelogram" };
                    }
                    else {
                        return { description: "irregular quadrilateral" };
                    }
                case sides == 5:
                    return { description: "pentagon" };
                case sides > 5:
                    const xData: Array<number> = [];
                    const yData: Array<number> = [];
                    for (let i = 0; i < h.length; i++) {
                        xData.push(h[i].x);
                        yData.push(h[i].y);
                    }
                    const slope: number = lin_reg(xData, yData)[1];
                    const xRatio: number = ((Math.max(...xData) - Math.min(...xData)) / (xMaxGlobal - xMinGlobal));
                    const yRatio: number = ((Math.max(...yData) - Math.min(...yData)) / (yMaxGlobal - yMinGlobal));
                    if (xRatio / yRatio > 2
                        || yRatio / xRatio > 2) {
                        if (xRatio > yRatio) {
                            return {
                                description: "elliptical: horizontal",
                                slope: slope
                            }
                        }
                        else {
                            return {
                                description: "elliptical: vertical",
                                slope: slope
                            }
                        }
                    }
                    else {
                        switch (true) {
                            case slope >= .3:
                                return {
                                    description: "elliptical: positively correlated",
                                    slope: slope
                                }
                            case slope <= -.3:
                                return {
                                    description: "elliptical: negatively correlated",
                                    slope: slope
                                }
                            case slope < .3 && slope > -.3
                                && (Math.max(...xData) - Math.min(...xData)) / (xMaxGlobal - xMinGlobal) > (Math.max(...yData) - Math.min(...yData)) / (yMaxGlobal - yMinGlobal):
                                return {
                                    description: "elliptical: horizontal",
                                    slope: slope
                                }
                            case slope < .3 && slope > -.3
                                && (Math.max(...xData) - Math.min(...xData)) / (xMaxGlobal - xMinGlobal) <= (Math.max(...yData) - Math.min(...yData)) / (yMaxGlobal - yMinGlobal):
                                return {
                                    description: "elliptical: vertical",
                                    slope: slope
                                }
                        }
                    }
            }
        }
        else {
            //Flatness <.7 are classified as linear
            const xData: Array<number> = [];
            const yData: Array<number> = [];
            for (let i = 0; i < h.length; i++) {
                xData.push(h[i].x);
                yData.push(h[i].y);
            }
            const slope: number = lin_reg(xData, yData)[1];
            switch (true) {
                case slope > .3:
                    return {
                        description: "roughly linear: positively correlated",
                        slope: slope
                    }
                case slope < -.3:
                    return {
                        description: "roughly linear: negatively correlated",
                        slope: slope
                    }
                case slope < .3 && slope > -.3
                    && (Math.max(...xData) - Math.min(...xData)) / (xMaxGlobal - xMinGlobal) > (Math.max(...yData) - Math.min(...yData)) / (yMaxGlobal - yMinGlobal):
                    return {
                        description: "roughly linear: horizontal",
                        slope: slope
                    }
                case slope < .3 && slope > -.3
                    && (Math.max(...xData) - Math.min(...xData)) / (xMaxGlobal - xMinGlobal) < (Math.max(...yData) - Math.min(...yData)) / (yMaxGlobal - yMinGlobal):
                    return {
                        description: "roughly linear: vertical",
                        slope: slope
                    }
            }
        }
        throw new Error("Something has gone wrong in judgeShape()");
    }
    return masterArray;
}


//Helper functions

function simplifyHull(inputShell: Array<coord>): Array<coord> {
    const shell: Array<Pair> = deCoordinate(inputShell);
    const precision: number = 15;
    let n: number = shell.length;
    //Trims vertices from the shell which change the angle of the incoming line by less than precision degrees
    for (let i = 0; i < n; i++) {
        const angle1: number = getAngle(shell[i % n], shell[(i + 1) % n]);
        const angle2: number = getAngle(shell[(i + 1) % n], shell[(i + 2) % n]);
        const difference: number = angle2 - angle1;
        if ((Math.abs(difference) < precision) || (Math.abs(difference + 360) < precision) || (Math.abs(difference - 360) < precision)) {
            shell.splice((i + 1) % n, 1);
            i--;
            n--;
        }
    }

    //'Fills in' small edges near corners
    const smallnessParameter = 20
    const peri: number = perimeter(inputShell);
    for (let i = 0; i < n; i++) {
        if (euclidDistance(shell[(i + 1) % n], shell[(i + 2) % n]) < (peri / smallnessParameter)) {
            const angle1: number = getAngle(shell[i % n], shell[(i + 1) % n]);
            const angle2: number = getAngle(shell[(i + 2) % n], shell[(i + 3) % n]);
            const difference: number = angle2 - angle1;
            if (!(160 < ((difference + 720) % 360) && ((difference + 720) % 360) < 200)) {
                const newPoint = completeAngle(shell[i % n], shell[(i + 1) % n], shell[(i + 2) % n], shell[(i + 3) % n])
                shell[(i + 1) % n] = newPoint;
                shell.splice((i + 2) % n, 1);
                i--;
                n--;
            }
        }
    }
    return coordinate(shell);
}


function completeAngle(p1: coord | Array<number>, p2: coord | Array<number>, p3: coord | Array<number>, p4: coord | Array<number>): Pair {
    //Calculates and returns the intersection point of the lines spanning p1-p2 and p3-p4.
    //See derivation here: https://www.desmos.com/calculator/vmgoniltui
    if (!Array.isArray(p1)) { p1 = [p1.x, p1.y] }
    if (!Array.isArray(p2)) { p2 = [p2.x, p2.y] }
    if (!Array.isArray(p3)) { p3 = [p3.x, p3.y] }
    if (!Array.isArray(p4)) { p4 = [p4.x, p4.y] }


    //Handles edge case when two points are aligned vertically
    if ((p2[0] - p1[0]) == 0) {
        if ((p4[0] - p3[0]) == 0) {
            //This should never happen if used on a convex polygon
            throw new Error("Error: attempting to compare parallel lines in completeAngle");
        }
        return [p1[0], (p4[1] - p3[1]) / (p4[0] - p3[0]) * p1[0] + p3[1] - (p4[1] - p3[1]) / (p4[0] - p3[0]) * p3[0]];
    }

    if ((p4[0] - p3[0]) == 0) {
        return [p3[0], (p2[1] - p1[1]) / (p2[0] - p1[0]) * p3[0] + p1[1] - (p2[1] - p1[1]) / (p2[0] - p1[0]) * p1[0]];
    }

    const slope12: number = (p2[1] - p1[1]) / (p2[0] - p1[0]);
    const slope34: number = (p4[1] - p3[1]) / (p4[0] - p3[0]);
    if ((slope12 - slope34) == 0) {
        //This should also never happen if used on a convex polygon
        throw new Error("Error: attempting to compare parallel lines in completeAngle");
    }
    const x: number = (p1[1] - p3[1] - slope12 * p1[0] + slope34 * p3[0]) / (slope34 - slope12);
    const newPoint: Pair = [x, slope12 * x + p1[1] - slope12 * p1[0]];
    return newPoint;
}
/*
function checkParallel(p1: coord | Array<number>, p2: coord | Array<number>, p3: coord | Array<number>, p4: coord | Array<number>): boolean {
    //Subfunction of completeAngle that is also useful to have as it's own function
    //Checks if the lines spanning p1-p2 and p3-p4 are parallel
    if (!Array.isArray(p1)) { p1 = [p1.x, p1.y] }
    if (!Array.isArray(p2)) { p2 = [p2.x, p2.y] }
    if (!Array.isArray(p3)) { p3 = [p3.x, p3.y] }
    if (!Array.isArray(p4)) { p4 = [p4.x, p4.y] }

    if ((p2[0] - p1[0]) == 0) {
        if ((p4[0] - p3[0]) == 0) {
            return true;
        }
        return false;
    }
    const slope12: number = (p2[1] - p1[1]) / (p2[0] - p1[0]);
    const slope34: number = (p4[1] - p3[1]) / (p4[0] - p3[0]);
    if ((slope12 - slope34) == 0) {
        return true;
    }
    else {
        return false;
    }
}
*/
function lin_reg(x: Array<number>, y: Array<number>): Array<number> {
    //Get slope and intercept from x and y arrays.  
    const n: number = x.length;
    let x_sum: number = 0;
    let y_sum: number = 0;
    let xy_sum: number = 0;
    let x2_sum: number = 0;
    for (let i = 0; i < n; i++) {
        const x_val = x[i];
        const y_val = y[i];
        x_sum += x_val;
        y_sum += y_val;
        xy_sum += x_val * y_val;
        x2_sum += x_val * x_val;
    }
    const slope: number = (n * xy_sum - x_sum * y_sum) / (n * x2_sum - x_sum * x_sum);
    const intercept: number = (y_sum / n) - slope * (x_sum / n);
    return [intercept, slope];
}
/*
function findHoles(cluster: clusterObject): Array<hole> {
    //Returns a list of non-overlapping holes, sorted from most to least significant.
    const clusterData: Array<coord> = coordinate(cluster.dataPoints);
    const voronoi = new Voronoi();
    const bbox = { xl: cluster.xMin, xr: cluster.xMax, yt: cluster.yMin, yb: cluster.yMax };

    const diagram = voronoi.compute(clusterData, bbox);
    const shell: Array<coord> = makeHull(clusterData)

    const edgePoints: Array<Array<number>> = [];
    const verticesInside: Array<Array<number>> = [];

    for (let edge of diagram.edges) {
        const va: Array<number> = [edge.va.x, edge.va.y];
        const vb: Array<number> = [edge.vb.x, edge.vb.y];
        const n: number = shell.length;
        for (let i = 0; i < n; i++) {
            if (!checkParallel(va, vb, shell[i % n], shell[(i + 1) % n])) {
                let intersection: Array<number> = completeAngle(va, vb, shell[i % n], shell[(i + 1) % n])
                if (((intersection[0] > va[0] && intersection[0] < vb[0]) || (intersection[0] < va[0] && intersection[0] > vb[0]))
                    && ((intersection[1] > va[1] && intersection[1] < vb[1]) || (intersection[1] < va[1] && intersection[1] > vb[1]))) {
                    edgePoints.push(intersection);
                }
            }

        }
    }

    const epsilon: number = 10 ** (Math.log10(Math.max((cluster.xMax - cluster.xMin), (cluster.yMax - cluster.yMin))) - 4)

    for (let point of deCoordinate(diagram.vertices)) {
        if (classifyPoint(deCoordinate(shell), point, epsilon) < 1) {
            verticesInside.push(point);
        }
    }

    for (let point of edgePoints) {
        if (classifyPoint(deCoordinate(shell), point, epsilon) < 1) {
            verticesInside.push(point);
        }
    }

    let minsArray: Array<Array<number>> = [];

    for (let vertexID = 0; vertexID < verticesInside.length; vertexID++) {
        let vertex: Array<number> = verticesInside[vertexID];
        let min: Array<number> = [Number(vertexID), euclidDistance(vertex, deCoordinate(clusterData)[0])];
        for (let point of deCoordinate(clusterData)) {
            if (min[1] > euclidDistance(vertex, point)) {
                min = [Number(vertexID), euclidDistance(vertex, point)]
            }
        }
        minsArray.push(min);
    }

    let sorted: Array<Array<number>> = minsArray.sort((a: number[], b: number[]) => { return b[1] - a[1] })

    //Culls similar holes by removing hole centers that lie within the border of a larger hole.
    for (let pointID = 0; pointID <  sorted.length; pointID++) {
        const point: Array<number> = sorted[pointID];
        let i: number = Number(pointID) + 1;
        while (i < sorted.length) {
            if (euclidDistance(verticesInside[point[0]], verticesInside[sorted[i][0]]) < point[1]) {
                sorted.splice(i, 1);
                i--;
            }
            i++;
        }
    }

    const deCoHull = deCoordinate(cluster.hull)
    let maxDistance = euclidDistance(deCoHull[0], cluster.centroid);
    let avgDistance: number = 0;

    for (let hullPoint of deCoHull) {
        const testDistance: number = euclidDistance(hullPoint, cluster.centroid)
        if (maxDistance < testDistance) {
            maxDistance = testDistance;
        }
        avgDistance += testDistance / deCoHull.length
    }

    const closest: Array<hole> = []
    for (let i = 0; i < sorted.length; i++) {
        const testHole: hole = [verticesInside[sorted[i][0]], sorted[i][1], 0]
        const centroidDistance = euclidDistance(testHole[0], cluster.centroid)
        const importanceScore = testHole[1] / avgDistance * (1 - centroidDistance / maxDistance)
        testHole[2] = importanceScore
        closest.push(testHole)
    }
    return (closest.sort((a: hole, b: hole) => { return b[2] - a[2] }));
}
*/
function euclidDistance(p: Array<number>, q: Array<number>): number {
    //Returns euclidean distance between vectors p and q.
    let sum: number = 0;
    let i: number = Math.min(p.length, q.length);
    while (i--) {
        sum += (p[i] - q[i]) * (p[i] - q[i]);
    }

    return Math.sqrt(sum);
}

function nNDistances(dataset: Array<Array<number>>, pointId: number): Array<number> {
    //Returns list of distances from nearest neighbors for a point, sorted low to high.
    const distances: Array<number> = [];
    for (let id = 0; id < dataset.length; id++) {
        const dist: number = euclidDistance(dataset[pointId], dataset[id]);
        distances.push(dist);
    }
    distances.sort((a: number, b: number) => { return a - b; });
    return distances

};

function nNDistancesSpecial(dataset: Array<Array<number>>, pointId: number, minPts: number): Array<number> {
    //Returns list of distances from nearest neighbors for a point, sorted low to high.
    const distances: Array<number> = [];
    for (let id = 0; id < dataset.length; id++) {
        const dist = euclidDistance(dataset[pointId], dataset[id]);
        distances.push(dist);
    }
    if (minPts < 100) return partialSort(distances, 2 * minPts);
    else return Array.from(distances.sort((a, b) => { return a - b; }));
};


function bisect(items: Array<number>, x: number, lo?: number, hi?: number): number {
    let mid: number;
    if (typeof (lo) == 'undefined') lo = 0;
    if (typeof (hi) == 'undefined') hi = items.length;
    while (lo < hi) {
        mid = Math.floor((lo + hi) / 2);
        if (x < items[mid]) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}

function insort(items: Array<number>, x: number): void {
    items.splice(bisect(items, x), 0, x);
}

function partialSort(items: Array<number>, k: number): Array<number> {
    let smallest: Array<number> = [];
    for (let i = 0, len = items.length; i < len; ++i) {
        const item: number = items[i];
        if (smallest.length < k || item < smallest[smallest.length - 1]) {
            insort(smallest, item);
            if (smallest.length > k)
                smallest.splice(k, 1);
        }
    }
    return smallest;
}

function nNIndices(dataset: Array<Array<number>>, pointId: number): Array<number> {
    //Returns list of nearest indices to a point, sorted low to high, including the point itself.
    let distances: Array<Array<number>> = [];
    for (let id = 0; id < dataset.length; id++) {
        const dist: Array<number> = [id, euclidDistance(dataset[pointId], dataset[id])];
        distances.push(dist);
    }

    distances = distances.sort((a, b) => { return a[1] - b[1]; });
    const indices: Array<number> = [];
    for (let i = 0; i < dataset.length; i++) {
        indices.push(distances[i][0]);
    }
    return indices;
};


function shoelace(data: Array<coord>): number {
    //Calculates area from set of points, intended to be used on convex hull with points ordered either c-wise or cc-wise
    if (data.length == 0) {
        return 0;
    }
    let sum: number = 0;
    const n: number = data.length;
    for (let i = 0; i < n - 1; i++) {
        sum += data[i].x * data[i + 1].y - data[i].y * data[i + 1].x
    }
    sum += data[n - 1].x * data[0].y - data[n - 1].y * data[0].x
    return Math.abs(sum / 2);
}

function perimeter(data: Array<coord>): number {
    //Calculates perimeter from set of points, intended to be used on convex hull with points ordered either c-wise or cc-wise
    let sum: number = 0;
    const n: number = data.length;
    if (n < 2) {
        return 0;
    }
    if (n == 2) {
        return euclidDistance([data[0].x, data[0].y], [data[1].x, data[1].y])
    }
    for (let i = 0; i < n - 1; i++) {
        let pointer: Array<number> = [data[i].x, data[i].y];
        let next: Array<number> = [data[i + 1].x, data[i + 1].y];
        sum += euclidDistance(pointer, next);
    }
    sum += euclidDistance([data[n - 1].x, data[n - 1].y], [data[0].x, data[0].y])
    return sum;
}

function flatness(data: Array<coord>): number {
    //Gets flatness coefficient from perimeter and area
    return (2 * Math.sqrt(shoelace(data) * Math.PI) / perimeter(data));
}

function getRegion(data: Array<Pair>): Array<number> {
    //Classifies datapoints into one of 9 regions (3x3) and returns an array of numbers describing those regions.

    const regions: Array<number> = [];
    const n: number = data.length;
    let xMax: number = data[0][0];
    let yMax: number = data[0][1];
    let xMin: number = data[0][0];
    let yMin: number = data[0][1];
    for (let i = 0; i < n; i++) {
        if (xMax < data[i][0]) {
            xMax = data[i][0];
        }
        if (xMin > data[i][0]) {
            xMin = data[i][0];
        }
        if (yMax < data[i][1]) {
            yMax = data[i][1];
        }
        if (yMin > data[i][1]) {
            yMin = data[i][1];
        }
    }
    const left: number = ((xMax - xMin) / 3) + xMin;
    const right: number = ((xMax - xMin) * 2 / 3) + xMin;
    const down: number = ((yMax - yMin) / 3) + yMin;
    const up: number = ((yMax - yMin) * 2 / 3) + yMin;

    for (let point of data) {
        const test: Array<boolean> = [point[0] < left, point[0] < right, point[1] < down, point[1] < up];
        switch (true) {
            case JSON.stringify(test) == JSON.stringify([true, true, true, true]):
                regions.push(0);
                break;
            case JSON.stringify(test) == JSON.stringify([false, true, true, true]):
                regions.push(1);
                break;
            case JSON.stringify(test) == JSON.stringify([false, false, true, true]):
                regions.push(2);
                break;
            case JSON.stringify(test) == JSON.stringify([true, true, false, true]):
                regions.push(3);
                break;
            case JSON.stringify(test) == JSON.stringify([false, true, false, true]):
                regions.push(4);
                break;
            case JSON.stringify(test) == JSON.stringify([false, false, false, true]):
                regions.push(5);
                break;
            case JSON.stringify(test) == JSON.stringify([true, true, false, false]):
                regions.push(6);
                break;
            case JSON.stringify(test) == JSON.stringify([false, true, false, false]):
                regions.push(7);
                break;
            case JSON.stringify(test) == JSON.stringify([false, false, false, false]):
                regions.push(8);
        }
    }
    return regions;
}

function judgeRegion(regionIDS: Array<number>): Array<string> {
    //Judges numerical regions into strings describing their location on a 3x3 grid.
    const regions: Array<string> = [];
    const n: number = regionIDS.length;
    for (let i = 0; i < n; i++) {
        const regionID: number = regionIDS[i];
        switch (true) {
            case regionID == 0:
                regions.push("bottom left");
                break;
            case regionID == 1:
                regions.push("bottom center");
                break;
            case regionID == 2:
                regions.push("bottom right");
                break;
            case regionID == 3:
                regions.push("left");
                break;
            case regionID == 4:
                regions.push("center");
                break;
            case regionID == 5:
                regions.push("right");
                break;
            case regionID == 6:
                regions.push("top left");
                break;
            case regionID == 7:
                regions.push("top center");
                break;
            case regionID == 8:
                regions.push("top right");
        }
    }
    return regions;
}


function getAngle(x: Array<number>, y: Array<number>): number {
    //Returns the numerical angle in degrees between a starting point x and a target point y
    const subtraction: Array<number> = y.map((num, index) => num - x[index]);
    let angle: number = 0;
    if (subtraction[0] == 0 && subtraction[1] > 0) {
        return 90;
    }
    else if (subtraction[0] == 0 && subtraction[1] < 0) {
        return 270;
    }
    else if (subtraction[1] == 0 && subtraction[0] >= 0) {
        return 0
    }
    else if (subtraction[1] == 0 && subtraction[0] < 0) {
        return 180
    }
    else {
        switch (true) {
            case subtraction[0] > 0 && subtraction[1] > 0:
                angle = Math.atan(subtraction[1] / subtraction[0])
                break;
            case subtraction[0] < 0 && subtraction[1] > 0:
                angle = Math.atan(subtraction[0] / subtraction[1])
                angle = Math.abs(angle) + Math.PI / 2;
                break;
            case subtraction[0] < 0 && subtraction[1] < 0:
                angle = Math.atan(subtraction[1] / subtraction[0])
                angle = Math.abs(angle) + Math.PI;
                break;
            case subtraction[0] > 0 && subtraction[1] < 0:
                angle = Math.atan(subtraction[0] / subtraction[1])
                angle = Math.abs(angle) + 3 * Math.PI / 2;
                break;
        }
    }

    angle = angle * 180 / Math.PI;
    return angle;
}


function judgeAngle(x: Array<number>, y: Array<number>): string {
    //Categorizes a numerical angle between two points into a cardinal direction
    const angle: number = getAngle(x, y);
    switch (true) {
        case 345 < angle || angle <= 15:
            return "east";
        case 15 < angle && angle <= 75:
            return "north-east";
        case 75 < angle && angle <= 105:
            return "north";
        case 105 < angle && angle <= 165:
            return "north-west";
        case 165 < angle && angle <= 195:
            return "west";
        case 195 < angle && angle <= 255:
            return "south-west";
        case 255 < angle && angle <= 285:
            return "south";
        case 285 < angle && angle <= 345:
            return "south-east";
    }
    throw new Error("Error: undefined angle in judgeAngle()");
}

function deCoordinate(array: Array<coord>): Array<Pair> {
    //Removes x-y coordinates from 2-d arrays
    if (array.length == 0) {
        return [];
    }
    const dataArray: Array<Pair> = [];
    for (let i = 0; i < array.length; i++) {
        dataArray.push([array[i]["x"], array[i]["y"]])
    }
    return dataArray;
}

function coordinate(array: Array<Pair>): Array<coord> {
    //Adds x-y coordinates to 2-d arrays
    if (array.length == 0) {
        return [];
    }
    const dataArray: Array<coord> = [];
    for (let i = 0; i < array.length; i++) {
        dataArray.push({ x: array[i][0], y: array[i][1] })
    }
    return dataArray;
}

function getCentroid(dataset: Array<Pair>): Pair {
    //Calculates centroid point of a data set
    var centroid: Pair = [0, 0];
    var i = 0;
    var j = 0;
    var l = dataset.length;

    for (i = 0; i < l; i++) {
        for (j = 0; j < dataset[i].length; j++) {
            if (centroid[j] !== undefined) {
                centroid[j] += dataset[i][j] / l;
            }
            else {
                centroid.push(0);
                centroid[j] += dataset[i][j] / l;
            }
        }
    }
    return centroid;
}
//Various functions relating to calculating measure-of-fit for a particularing clustering, currently unused.
/*
const silhouette = require('@robzzson/silhouette');
const datasetCentroid = getCentroid(dataArray);

var BCSS = 0;
var WCSS = 0;
for (let i = 0; i < clusters.length; i++){
  var clusteredData = [];
  for (let j = 0; j < clusters[i].length; j++){
    clusteredData.push(dataArray[clusters[i][j]])
  }
  BCSS += clusteredData.length * euclidDistance(getCentroid(clusteredData), datasetCentroid);
}
for (let i = 0; i < clusters.length; i++){
  var clusteredData = [];
  for (let j = 0; j < clusters[i].length; j++){
    clusteredData.push(dataArray[clusters[i][j]])
  }
  for (let j = 0; j < clusteredData.length; j++){
    WCSS += euclidDistance(clusteredData[j], getCentroid(clusteredData));
  }
  
}
CHI = BCSS*(dataArray.length-clusters.length)/(WCSS*(clusters.length-1))
console.log(`Calinski–Harabasz index: ${CHI}`)



var silhouetteLabels = [];
for (let i = 0; i < dataArray.length; i++){
  silhouetteLabels.push(0);
}
for (let i = 0; i < clusters.length; i++){
  //console.log(i);
  for (let j = 0; j < clusters[i].length; j++){
    //console.log(j);
    silhouetteLabels[clusters[i][j]] = i;
  }
}
let silhouetteScore = silhouette(dataArray, silhouetteLabels);
console.log(`Sillhouette score: ${silhouetteScore}`);
*/

//Types
type clusterObject = {
    area: number,
    centroid: Array<number>,
    dataPoints: Array<Pair>,
    dataPointIDs: Array<number>,
    outliers: Array<Pair>,
    outlierIDs: Array<number>,
    density: number,
    densityRank: number,
    hasSignificantHole: boolean,
    holes: Array<hole>,
    hull: Array<coord>,
    hullIDs: Array<number>,
    hullSimplified: Array<coord>,
    id: number,
    label?: string,
    perimeter: number,
    region: number,
    regionDesc: string,
    relations: Array<relation>,
    shape: { description: string },
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number
}
type coord = {
    x: number,
    y: number
}
type relation = {
    angle: number,
    cardDirection: string,
    distance: number,
    id: number,
    isNeighbor?: boolean
    overlap?: number
    sharedPts?: Array<Pair>
    percentPtsShared?: number
}
type hole = [Array<number>, number, number]

type LabelFactorPair = { label: any, factor: number }

type Pair = [number, number]
