interface JsonRowProps {
    level: number
    type: "primitive" | "object" | "array" | "close-bracket" | "close-brace"
    primitiveType?:
        | "string"
        | "number"
        | "bigint"
        | "boolean"
        | "symbol"
        | "undefined"
        | "object"
        | "function"
        | "null"
    key: string
    value?: any
    isParentArray?: boolean
    length?: number
}

function timeout(delay: any) {
    return new Promise((resolve) => {
        setTimeout(resolve, delay)
    })
}

function emptyTimeout() {
    return new Promise((resolve) => {
        resolve(null)
    })
}

// ██████╗  █████╗ ██████╗ ████████╗██╗ █████╗ ██╗         ██████╗  █████╗ ██████╗ ███████╗███████╗
// ██╔══██╗██╔══██╗██╔══██╗╚══██╔══╝██║██╔══██╗██║         ██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔════╝
// ██████╔╝███████║██████╔╝   ██║   ██║███████║██║         ██████╔╝███████║██████╔╝███████╗█████╗
// ██╔═══╝ ██╔══██║██╔══██╗   ██║   ██║██╔══██║██║         ██╔═══╝ ██╔══██║██╔══██╗╚════██║██╔══╝
// ██║     ██║  ██║██║  ██║   ██║   ██║██║  ██║███████╗    ██║     ██║  ██║██║  ██║███████║███████╗
// ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝╚═╝  ╚═╝╚══════╝    ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝
//
function parse(s: string): any {
    try {
        return JSON.parse(s)
    } catch (e) {
        const [data, reminding] = parseAny(s, e)
        return data
    }
}

function parseAny(s: string, e: Error): ParseResult<any> {
    const parser = parsers[s[0]]
    if (!parser) {
        console.error(`no parser registered for ${JSON.stringify(s[0])}:`, { s })
        throw e
    }
    return parser(s, e)
}

type Code = string
type Parser<T> = (s: Code, e: Error) => ParseResult<T>
type ParseResult<T> = [T, Code]

const parsers: Record<string, Parser<any>> = {}

function skipSpace(s: string): string {
    return s.trimLeft()
}

parsers[" "] = parseSpace
parsers["\r"] = parseSpace
parsers["\n"] = parseSpace
parsers["\t"] = parseSpace

function parseSpace(s: string, e: Error) {
    s = skipSpace(s)
    return parseAny(s, e)
}

parsers["["] = parseArray

function parseArray(s: string, e: Error): ParseResult<any[]> {
    s = s.substr(1) // skip starting '['
    const acc: any[] = []
    s = skipSpace(s)
    for (; s.length > 0; ) {
        if (s[0] === "]") {
            s = s.substr(1) // skip ending ']'
            break
        }
        const res = parseAny(s, e)
        acc.push(res[0])
        s = res[1]
        s = skipSpace(s)
        if (s[0] === ",") {
            s = s.substring(1)
            s = skipSpace(s)
        }
    }
    return [acc, s]
}

for (const c of "0123456789.-".slice()) {
    parsers[c] = parseNumber
}

function parseNumber(s: string): ParseResult<number | string> {
    for (let i = 0; i < s.length; i++) {
        const c = s[i]
        if (parsers[c] === parseNumber) {
            continue
        }
        const num = s.substring(0, i)
        s = s.substring(i)
        return [numToStr(num), s]
    }
    return [numToStr(s), ""]
}

function numToStr(s: string) {
    if (s === "-") {
        return -0
    }
    const num = +s
    if (Number.isNaN(num)) {
        return s
    }
    return num
}

parsers['"'] = parseString

function parseString(s: string): ParseResult<string> {
    for (let i = 1; i < s.length; i++) {
        const c = s[i]
        if (c === "\\") {
            i++
            continue
        }
        if (c === '"') {
            const str = s.substring(0, i + 1)
            s = s.substring(i + 1)
            return [JSON.parse(str), s]
        }
    }
    return [JSON.parse(s + '"'), ""]
}

parsers["{"] = parseObject

function parseObject(s: string, e: Error): ParseResult<object> {
    s = s.substr(1) // skip starting '{'
    const acc: any = {}
    s = skipSpace(s)
    for (; s.length > 0; ) {
        if (s[0] === "}") {
            s = s.substr(1) // skip ending '}'
            break
        }

        const keyRes = parseAny(s, e)
        const key = keyRes[0]
        s = keyRes[1]

        s = skipSpace(s)
        if (s[0] !== ":") {
            acc[key] = undefined
            break
        }
        s = s.substr(1) // skip ':'
        s = skipSpace(s)

        if (s.length === 0) {
            acc[key] = undefined
            break
        }
        const valueRes = parseAny(s, e)
        acc[key] = valueRes[0]
        s = valueRes[1]
        s = skipSpace(s)

        if (s[0] === ",") {
            s = s.substr(1)
            s = skipSpace(s)
        }
    }
    return [acc, s]
}

parsers["t"] = parseTrue

function parseTrue(s: string, e: Error): ParseResult<true> {
    return parseToken(s, `true`, true, e)
}

parsers["f"] = parseFalse

function parseFalse(s: string, e: Error): ParseResult<false> {
    return parseToken(s, `false`, false, e)
}

parsers["n"] = parseNull

function parseNull(s: string, e: Error): ParseResult<null> {
    return parseToken(s, `null`, null, e)
}

function parseToken<T>(s: string, tokenStr: string, tokenVal: T, e: Error): ParseResult<T> {
    for (let i = tokenStr.length; i >= 1; i--) {
        if (s.startsWith(tokenStr.slice(0, i))) {
            return [tokenVal, s.slice(i)]
        }
    }
    /* istanbul ignore next */
    {
        const prefix = JSON.stringify(s.slice(0, tokenStr.length))
        console.error(`unknown token starting with ${prefix}:`, { s })
        throw e
    }
}

// ████████╗██████╗  █████╗ ███╗   ██╗███████╗███████╗ ██████╗ ██████╗ ███╗   ███╗███████╗██████╗
// ╚══██╔══╝██╔══██╗██╔══██╗████╗  ██║██╔════╝██╔════╝██╔═══██╗██╔══██╗████╗ ████║██╔════╝██╔══██╗
//    ██║   ██████╔╝███████║██╔██╗ ██║███████╗█████╗  ██║   ██║██████╔╝██╔████╔██║█████╗  ██████╔╝
//    ██║   ██╔══██╗██╔══██║██║╚██╗██║╚════██║██╔══╝  ██║   ██║██╔══██╗██║╚██╔╝██║██╔══╝  ██╔══██╗
//    ██║   ██║  ██║██║  ██║██║ ╚████║███████║██║     ╚██████╔╝██║  ██║██║ ╚═╝ ██║███████╗██║  ██║
//    ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝      ╚═════╝ ╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚═╝  ╚═╝
//

let transformedArray: JsonRowProps[] = []
let finishedProcessing = false
const PAGE_SIZE = 50
// const PAGE_SIZE_AFTER_PROCESSING = 10000000
const PAGE_SIZE_AFTER_PROCESSING = 50
const PAGE_SIZE_SEARCH = 5000
const PAGE_SIZE_SCOPED = 1000
const isFirstPage = true

const jsonTransformWorker = async (json: Object, turbo, parcial = false) => {
    let n = 0
    const transformJson = async (json: any): Promise<JsonRowProps[]> => {
        await processObject(0, json, 0, transformedArray)
        if (!parcial) {
            finishedProcessing = true
        }
        if (turbo) {
            postMessage({ finishedProcessing: true, totalRows: transformedArray.length })
        }
        return transformedArray
    }

    const processObject = async (
        i: number,
        json: any,
        level: number,
        transformedArray: JsonRowProps[],
        isParentArray?: boolean
    ) => {
        const keys = Object.keys(json)
        for (let index = 0; index < keys.length; index++) {
            if (!turbo && !parcial) {
                if (n++ === 100) postMessage({ page: transformedArray, end: false })
                if (n >= 100) {
                    await timeout(1)
                }
            }
            const key = keys[index]
            const value = json[key] === null ? "null" : json[key]
            const isArray = Array.isArray(value)
            const type = typeof value === "object" ? (isArray ? "array" : "object") : "primitive"

            transformedArray.push({
                level,
                type,
                key,
                value: type === "primitive" ? value + "" : undefined,
                primitiveType:
                    type === "primitive" ? (json[key] === null ? "null" : typeof value) : undefined,
                isParentArray,
                // length: typeof value === "string" ? Math.floor((value + "").length / 30) || 1 : 1,
                length: typeof value === "string" ? value.length : 0,
            })

            if (typeof value === "object") {
                await processObject(i++, value, level + 1, transformedArray, isArray)
                transformedArray.push({
                    level,
                    type: isArray ? "close-brace" : "close-bracket",
                    key,
                    value: type === "primitive" ? value : undefined,
                    length: typeof value === "string" ? value.length : 0,
                    // lines:
                    //     typeof value === "string" ? Math.floor((value + "").length / 30) || 1 : 1,
                })
            }
        }
    }

    return transformJson(json)
}

//  ██████╗ ███╗   ██╗    ███╗   ███╗███████╗███████╗███████╗ █████╗  ██████╗ ███████╗
// ██╔═══██╗████╗  ██║    ████╗ ████║██╔════╝██╔════╝██╔════╝██╔══██╗██╔════╝ ██╔════╝
// ██║   ██║██╔██╗ ██║    ██╔████╔██║█████╗  ███████╗███████╗███████║██║  ███╗█████╗
// ██║   ██║██║╚██╗██║    ██║╚██╔╝██║██╔══╝  ╚════██║╚════██║██╔══██║██║   ██║██╔══╝
// ╚██████╔╝██║ ╚████║    ██║ ╚═╝ ██║███████╗███████║███████║██║  ██║╚██████╔╝███████╗
//  ╚═════╝ ╚═╝  ╚═══╝    ╚═╝     ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
//
onmessage = async (e: any) => {
    let pageSize = e.data?.pageSize || (finishedProcessing ? PAGE_SIZE_AFTER_PROCESSING : PAGE_SIZE)
    if (e.data?.parcial) {
        const partialFile = e.data?.file.slice(0, 1000)
        try {
            const parcial = parse(new FileReaderSync().readAsText(partialFile))
            jsonTransformWorker(parcial, false, true).then((array) => {
                postMessage({ pageParcial: transformedArray })
            })
        } catch (e) {
            console.log(e)
            postMessage({ error: true })
        }
    }
    if (e.data?.file) {
        await timeout(100)
        try {
            transformedArray = []
            jsonTransformWorker(
                JSON.parse(new FileReaderSync().readAsText(e.data?.file)),
                e.data?.turbo
            ).then((array) => {
                if (array.length < pageSize) {
                    postMessage({ page: transformedArray, end: false, reset: true })
                }
            })
        } catch (e) {
            postMessage({ error: true })
        }
    }
    if (e.data?.reset) {
        postMessage({ page: transformedArray.slice(0, PAGE_SIZE_AFTER_PROCESSING), reset: true })
    }
    if (e.data?.offset && transformedArray) {
        let page = transformedArray.slice(e.data?.offset, e.data?.offset + pageSize) || []
        let attemps = 0
        while (attemps++ < 30 && page.length < pageSize && !finishedProcessing) {
            await timeout(100)
            page = transformedArray.slice(e.data?.offset, e.data?.offset + pageSize) || []
        }
        const end = finishedProcessing && e.data?.offset + pageSize >= transformedArray.length
        postMessage({ page, end })
    }

    if (e.data?.search) {
        const index = transformedArray?.findIndex((el) => {
            return (el?.key + "" + (el?.type === "primitive" ? el?.value + "" : ""))?.includes?.(
                e.data?.search
            )
        })

        if (index > -1 && index > e.data?.loadedLength) {
            let n = PAGE_SIZE_SEARCH + index - e.data?.loadedLength
            const totalPages = Math.floor(n / PAGE_SIZE_SEARCH) + 1

            if (totalPages > 30) {
                postMessage({
                    searchResultIndex: PAGE_SIZE_SCOPED,
                    searchScopeMode: true,
                    pageSearch: transformedArray.slice(
                        Math.max(index - PAGE_SIZE_SCOPED, 0),
                        index + PAGE_SIZE_SCOPED
                    ),
                })
                return
            }

            let k = 0
            while (n > 0) {
                const initialIndex = e.data?.loadedLength + PAGE_SIZE_SEARCH * k++
                postMessage({
                    pageSearch: transformedArray.slice(
                        initialIndex,
                        initialIndex + PAGE_SIZE_SEARCH
                    ),
                })
                n -= PAGE_SIZE_SEARCH
                await timeout(1)
            }
            postMessage({ searchResultIndex: index })
        } else {
            postMessage({ searchResultIndex: index })
        }
    }
}
