import { cMaj3 } from "@/assets/scales"

export const getRandomFreq = () => {
    return cMaj3[Math.floor(Math.random() * (7 + 1))]
}
