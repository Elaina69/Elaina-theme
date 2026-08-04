import * as upl from "pengu-upl";

/**
 * @wiki Automatically skips the post-game honor voting screen when Auto Queue is enabled. Instantly submits the honor ballot so you go straight back to the lobby without having to manually honor a player.
 * @author Elaina Da Catto
 * @settings Auto-Find-Queue
 */
export function skipHonor(context: any) {
    if (!ElainaData.get("Auto-Find-Queue")) return;

    upl.hooks.ember.extendClassByMatching(
        (component: any) => component.baseClassName === "honor-vote-ceremony-v3",
        () => ({
            beginTransition: function () {
                this.set("selectionChosen", true);
                this._beginTransitionTimer = null;
                this.runTask(function () {
                    this.submitBallot();
                }, 0);
            },
            willRender: function () {
                this.send("submitSelection");
            }
        })
    );
}
