const {RWSPluginBuilder} = require('@rws-framework/client/src/plugins/_builder');

class WSBuilder extends RWSPluginBuilder{
    constructor(buildConfigurator, baseBuildConfig){
        super(__dirname, buildConfigurator, baseBuildConfig);
    }
    
    async onBuild(webpackOptions){
        this.log('webpack build modified');
        return webpackOptions;
    }
}

module.exports = WSBuilder;