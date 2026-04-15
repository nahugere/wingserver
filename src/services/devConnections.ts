class DevConnections {
    
    private static connections = new Map<string, any>();

    static addConnection(projectId: string, ws: any) {
        this.connections.set(projectId, ws);
    }

    static getAllConnections() {
        return this.connections;
    }

    static getConnection(projectId: string) {
        return this.connections.get(projectId);
    }

    static removeConnection(projectId: string) {
        this.connections.delete(projectId);
    }

    static hasConnection(projectId: string) {
        return this.connections.has(projectId);
    }
}

export default DevConnections;