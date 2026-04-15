export const responseSchema = (statusCode?: number, description?: string, data?: any) => {
    return {
        "statusCode": statusCode,
        "detail": description,
        "data": data
    };
}