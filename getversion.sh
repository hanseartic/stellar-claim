#!/usr/bin/env bash
SHORT_SHA=${GITHUB_SHA::7}
REACT_APP_VERSION=${SHORT_SHA:-$(git rev-parse --short HEAD)}
echo $REACT_APP_VERSION > public/VERSION
