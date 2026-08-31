import { Building2, Landmark, Leaf } from 'lucide-react'

export const melbourneCenter = [-37.8136, 144.9631]

export const mapPlaces = [
  {
    icon: Leaf,
    name: 'Flagstaff Gardens',
    type: 'Green space',
    distance: '4 min walk',
    status: 'Best match',
    marker: '1',
    markerTone: 'green',
    position: [-37.8101, 144.955],
    address: 'William Street, West Melbourne',
  },
  {
    icon: Leaf,
    name: 'Docklands Park',
    type: 'Waterfront green space',
    distance: '9 min walk',
    status: 'Open now',
    marker: '2',
    markerTone: 'gold',
    position: [-37.8217, 144.9475],
    address: 'Harbour Esplanade, Docklands',
  },
  {
    icon: Building2,
    name: 'State Library Victoria',
    type: 'Quiet public space',
    distance: '11 min walk',
    status: 'Low noise',
    marker: '3',
    markerTone: 'blue',
    position: [-37.8098, 144.9652],
    address: '328 Swanston Street, Melbourne',
  },
  {
    icon: Landmark,
    name: 'Federation Square',
    type: 'Open public square',
    distance: '14 min walk',
    status: 'Outdoor',
    marker: '4',
    markerTone: 'gold',
    position: [-37.8179, 144.9691],
    address: 'Swanston Street, Melbourne',
  },
]
