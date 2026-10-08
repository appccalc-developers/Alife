import { Matrix4, Object3D } from 'three'
import { STUDY_COMPANION_SEATS } from './virtualChurchStudyPose.ts'

type Point = [number, number, number]
export type StudyFurnitureBatch = {
  id: string; color: string; roughness: number; shadows: boolean; matrices: Matrix4[]
}

/** Chair-local shared geometry; Bible unit boxes retain the handheld transforms. */
export function buildStudyFurnitureBatches(books: Array<Point | undefined>, overview: boolean): StudyFurnitureBatch[] {
  const batches: StudyFurnitureBatch[] = [
    { id: 'chair-upholstery', color: '#456658', roughness: .95, shadows: true, matrices: [] },
    { id: 'chair-legs', color: '#6d503a', roughness: .9, shadows: true, matrices: [] },
    { id: 'bible-covers', color: '#29473b', roughness: .95, shadows: false, matrices: [] },
    { id: 'bible-pages', color: '#fff3d5', roughness: 1, shadows: false, matrices: [] },
    { id: 'bible-lines', color: '#ab9d81', roughness: .9, shadows: false, matrices: [] },
  ]
  const transform = (position: Point, rotation: Point = [0, 0, 0], scale: Point = [1, 1, 1]) => {
    const node = new Object3D()
    node.position.set(...position); node.rotation.set(...rotation); node.scale.set(...scale); node.updateMatrix()
    return node.matrix
  }
  const box = (batch: number, parent: Matrix4, position: Point, size: Point, rotation: Point = [0, 0, 0]) => {
    batches[batch].matrices.push(parent.clone().multiply(transform(position, rotation, size)))
  }
  const chair = (parent: Matrix4) => {
    batches[0].matrices.push(parent.clone())
    for (const x of [-.23, .23]) for (const z of [-.2, .2]) box(1, parent, [x, .24, z], [.045, .48, .045])
  }
  const bible = (parent: Matrix4, position: Point) => {
    const book = parent.clone().multiply(transform(position, [.22, 0, 0]))
    for (const side of [-1, 1]) {
      const half = book.clone().multiply(transform([side * .095, 0, 0], [0, 0, side * .09]))
      box(2, half, [0, 0, 0], [.19, .018, .26])
      box(3, half, [0, .016, 0], [.178, .015, .244])
      for (let index = 0; index < 7; index++) box(4, half, [0, .025, -.082 + index * .025], [.135, .001, .0015])
    }
  }
  STUDY_COMPANION_SEATS.forEach((seat, index) => {
    const parent = transform(seat.position, [0, seat.yaw, 0])
    chair(parent)
    if (books[index]) bible(parent, books[index])
  })
  if (overview) chair(transform([0, 0, 2], [0, Math.PI, 0]))
  bible(new Matrix4(), [.2, .754, .32])
  return batches
}
