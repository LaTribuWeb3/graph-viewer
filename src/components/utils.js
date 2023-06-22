export const colors = [
    "#1095C1",
    "#6bc44e",
    "#995fd8",
    "#a5bb36",
    "#a83ca8",
    "#3d9836",
    "#e06fce",
    "#4ac787",
    "#e14492",
    "#2e7741",
    "#576dd7",
    "#ceb13c",
    "#83579e",
    "#749232",
    "#b03a78",
    "#67a96b",
    "#dd4469",
    "#54c1ae",
    "#c93942",
    "#4db8df",
    "#e76138",
    "#5984c4",
    "#dd882e",
    "#b791dc",
    "#a6862c",
    "#de84b0",
    "#52712c",
    "#974d6f",
    "#a3b36b",
    "#b24521",
    "#30866c",
    "#e4827b",
    "#746d2b",
    "#a64d54",
    "#daa269",
    "#9c5e31",
  ];
  export function largeNumberFormatter(number) {
    if (number >= 1e9) {
        return `${(Number((number / (1e9)).toFixed(2)))}B`;
    }
    if (number >= 1e6) {
        return `${(Number((number / (1e6)).toFixed(2)))}M`
    }
    if (number >= 1e3) {
        return `${(Number((number / (1e3)).toFixed(2)))}K`
    }
    if (number >= 0) {
    return `${(Number(number).toFixed(2))}`
    }
    return number
}
