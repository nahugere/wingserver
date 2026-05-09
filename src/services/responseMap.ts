class ResponseMap {
    
    private static responses = new Map<string, any>();

    static addConnection(projectId: string, ws: any) {
        if (this.getResponse(projectId)==null) {
            this.responses.set(projectId, ws);
        }
    }

    static getAllResponses() {
        return this.responses;
    }

    static getResponse(projectId: string) {
        return this.responses.get(projectId);
    }

    static removeResponses(projectId: string) {
        this.responses.delete(projectId);
    }

    static hasResponses(projectId: string) {
        return this.responses.has(projectId);
    }
}

export default ResponseMap;