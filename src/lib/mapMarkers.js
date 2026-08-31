import { Icon } from 'leaflet'

const markerColors = {
  green: '#08713f',
  gold: '#f28c22',
  blue: '#0b66df',
}

export function createMarkerIcon(marker, tone) {
  const color = markerColors[tone] ?? markerColors.green
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42"><path fill="${color}" stroke="white" stroke-width="3" d="M21 3c8.3 0 15 6.4 15 14.4 0 10.6-15 21.6-15 21.6S6 28 6 17.4C6 9.4 12.7 3 21 3Z"/><text x="21" y="23" text-anchor="middle" fill="white" font-family="Arial" font-size="15" font-weight="700">${marker}</text></svg>`

  return new Icon({
    iconUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    iconSize: [42, 42],
    iconAnchor: [21, 38],
    popupAnchor: [0, -36],
  })
}
