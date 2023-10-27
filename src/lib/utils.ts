export function timeout(delay: any) {
    return new Promise((resolve) => {
        setTimeout(resolve, delay)
    })
}
