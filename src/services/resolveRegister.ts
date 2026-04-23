class ResolveRegister {
    
    private static resolves = new Map<string, any>();

    static addResolve(requestId: string, resolve: any) {
        this.resolves.set(requestId, resolve);
    }

    static getAllResolves() {
        return this.resolves;
    }

    static getResolve(requestId: string) {
        return this.resolves.get(requestId);
    }

    static removeResolve(requestId: string) {
        this.resolves.delete(requestId);
    }

    static hasResolve(requestId: string) {
        return this.resolves.has(requestId);
    }
}

export default ResolveRegister;