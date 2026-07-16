#!/bin/bash
# Payload Manager - Versioned Build Script

# 1. Extract version from include/pldmgr.h
VERSION=$(grep '#define MENU_VERSION' include/pldmgr.h | awk '{print $3}' | tr -d '"' | tr -d '\r')

if [ -z "$VERSION" ]; then
    echo "Error: Could not find MENU_VERSION in include/pldmgr.h"
    exit 1
fi

OUTPUT_ELF="pldmgr_v${VERSION}.elf"
IMAGE_NAME="ps5-payload-sdk-pldmgr"

echo "--- Building Payload Manager v$VERSION ---"

# 2. Build React Frontend (on Host)
echo "[1/3] Building React Frontend..."
make frontend-build > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "      !!! Frontend build FAILED!"
    exit 1
fi
echo "      Frontend build successful."

# 2b. Build/verify the docker image
if [[ "$(docker images -q $IMAGE_NAME 2> /dev/null)" == "" ]]; then
    echo "      Docker image $IMAGE_NAME not found. Building... (this may take a few minutes)"
    docker build -t $IMAGE_NAME -f Dockerfile.sdk .
    if [ $? -ne 0 ]; then
        echo "      !!! Docker image build FAILED!"
        exit 1
    fi
    echo "      Docker image built successfully."
fi

# 3. Build native ELF via Docker
echo "[2/3] Building native ELF via Docker..."
docker run --rm -v "$(pwd)":/src -w /src $IMAGE_NAME make clean all
if [ $? -ne 0 ]; then
    echo "      !!! ELF build FAILED!"
    exit 1
fi
echo "      ELF build successful."

# 4. Rename output
if [ -f "pldmgr.elf" ]; then
    mv pldmgr.elf "$OUTPUT_ELF"
    echo "[3/3] Created versioned binary: $OUTPUT_ELF"
    echo "--- Build Complete! ---"
else
    echo "      !!! pldmgr.elf not found after build!"
    exit 1
fi
