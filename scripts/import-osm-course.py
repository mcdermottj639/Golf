#!/usr/bin/env python3
"""Extract original OSM way IDs, tags, versions and coordinates for one course."""

import argparse
import json
import xml.etree.ElementTree as ET
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("xml", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--source", required=True)
    parser.add_argument("--retrieved", required=True)
    parser.add_argument("--bounds", nargs=4, type=float, required=True,
                        metavar=("SOUTH", "WEST", "NORTH", "EAST"))
    parser.add_argument("--course-boundary-id", type=int)
    return parser.parse_args()


def main():
    args = parse_args()
    root = ET.parse(args.xml).getroot()
    nodes = {
        int(node.attrib["id"]): [float(node.attrib["lat"]), float(node.attrib["lon"])]
        for node in root.findall("node")
    }
    south, west, north, east = args.bounds

    def inside(point):
        return south < point[0] < north and west < point[1] < east

    features = []
    for way in root.findall("way"):
        tags = {tag.attrib["k"]: tag.attrib["v"] for tag in way.findall("tag")}
        if not (tags.get("golf") or tags.get("natural") == "water" or
                tags.get("natural") == "wood" or tags.get("landuse") == "forest"):
            continue
        path = [nodes[int(nd.attrib["ref"])] for nd in way.findall("nd")
                if int(nd.attrib["ref"]) in nodes]
        if not path or not all(inside(point) for point in path):
            continue
        features.append({
            "id": int(way.attrib["id"]),
            "version": int(way.attrib["version"]),
            "tags": tags,
            "path": path,
        })

    result = {
        "source": args.source,
        "retrieved": args.retrieved,
        "license": "ODbL-1.0",
        "attribution": "© OpenStreetMap contributors",
    }
    if args.course_boundary_id is not None:
        result["courseBoundaryId"] = args.course_boundary_id
    result["features"] = features
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output} with {len(features)} source features.")


if __name__ == "__main__":
    main()
