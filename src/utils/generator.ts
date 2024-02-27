// import { cMaj3 } from "@/assets/scales"

// export const getRandomFreq = () => {
//     return cMaj3[Math.floor(Math.random() * (7 + 1))]
// }


export const getRandomNumber = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

export const getRandomNote = () => {
    return getRandomNumber(0, 12)
}
