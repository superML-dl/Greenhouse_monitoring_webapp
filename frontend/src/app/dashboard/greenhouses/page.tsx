import { getGreenhouses } from './actions'
import { GreenhouseList } from './components/greenhouse-list'

export default async function GreenhousesPage() {
  const greenhouses = await getGreenhouses()

  return <GreenhouseList greenhouses={greenhouses} />
}
