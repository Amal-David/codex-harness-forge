export function renderComprehensiveWorkflowReport(payload) {
  const lines = [];
  lines.push("# Comprehensive Workflows Evaluation");
  lines.push("");
  lines.push(`Generated: ${payload.generatedAt}`);
  lines.push(`Repo: \`${payload.repoRoot}\``);
  lines.push(`Output: \`${payload.outputRoot}\``);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Usecases: ${payload.summary.usecaseCount}`);
  lines.push(`- Checks: ${payload.summary.passedChecks}/${payload.summary.totalChecks} passed`);
  lines.push(`- Runs: ${payload.summary.successRuns} success, ${payload.summary.partialRuns} partial, ${payload.summary.failedRuns} failed`);
  lines.push(`- Cases with failed checks: ${payload.summary.casesWithFailedChecks.join(", ") || "none"}`);
  lines.push("");
  lines.push("## Systemic Findings");
  lines.push("");
  for (const finding of payload.systemicFindings) {
    lines.push(`- ${finding}`);
  }
  lines.push("");
  lines.push("## Case Matrix");
  lines.push("");
  lines.push("| Case | Status | Exit | Packs | Critic Qs | Blockers | Failed Checks |");
  lines.push("| --- | --- | ---: | --- | ---: | ---: | --- |");
  for (const result of payload.results) {
    lines.push(
      `| ${escapeCell(result.title)} | ${result.finalStatus} | ${result.exitCode} | ${escapeCell(result.observedPacks.join(", "))} | ${result.criticQuestionCount} | ${result.unresolvedBlockerQuestionCount} | ${escapeCell(result.failedChecks.map((check) => check.id).join(", ") || "none")} |`,
    );
  }
  lines.push("");
  lines.push("## Failures And Gaps");
  lines.push("");
  for (const result of payload.results.filter((item) => item.failedChecks.length > 0)) {
    lines.push(`### ${result.title}`);
    lines.push("");
    lines.push(`Output: \`${result.outputDir}\``);
    lines.push("");
    for (const check of result.failedChecks) {
      lines.push(`- ${check.id}: ${check.label}. Detail: ${check.detail}`);
    }
    lines.push("");
  }
  lines.push("## Per-Case Details");
  lines.push("");
  for (const result of payload.results) {
    lines.push(`### ${result.title}`);
    lines.push("");
    lines.push(`- id: \`${result.id}\``);
    lines.push(`- output: \`${result.outputDir}\``);
    lines.push(`- finalStatus: \`${result.finalStatus}\`, exit: \`${result.exitCode}\`, council: \`${result.councilVerdict ?? "none"}\``);
    lines.push(`- selectedArchetype: \`${result.selectedArchetype ?? "none"}\``);
    lines.push(`- routeComposition: ${result.routeComposition?.matchedPacks?.map((pack) => `\`${pack.packId}:${pack.score}\``).join(", ") || "none"}`);
    lines.push(`- packs: ${result.observedPacks.map((pack) => `\`${pack}\``).join(", ") || "none"}`);
    lines.push(`- runtimeControl: \`initialization=${result.runtimeControl.initializationStatus}, scheduler=${result.runtimeControl.featureSchedulerStatus}/${result.runtimeControl.activeFeatureCount}, environment=${result.runtimeControl.environmentReadinessStatus}/${result.runtimeControl.environmentReadinessFailedCheckCount}/${result.runtimeControl.environmentReadinessWarningCheckCount}/${result.runtimeControl.environmentReadinessLockfileCount}, instructions=${result.runtimeControl.instructionRouterStatus}/${result.runtimeControl.instructionTopicCount}, context=${result.runtimeControl.contextBudgetStatus}/${result.runtimeControl.contextBudgetEstimatedTokenCount}/${result.runtimeControl.contextBudgetMaxTokenBudget}, sourceRecord=${result.runtimeControl.sourceOfRecordStatus}/${result.runtimeControl.sourceOfRecordAnsweredQuestionCount}, lifecycle=${result.runtimeControl.lifecycleStatus}/${result.runtimeControl.lifecyclePhaseCount}, architecture=${result.runtimeControl.architectureBoundaryStatus}/${result.runtimeControl.architectureBoundaryViolationCount}, rubric=${result.runtimeControl.evaluatorRubricStatus}/${result.runtimeControl.evaluatorRubricPassingDimensionCount}/${result.runtimeControl.evaluatorRubricDimensionCount}, authority=${result.runtimeControl.completionAuthorityStatus}/${result.runtimeControl.completionAuthorityGateCount}/${result.runtimeControl.completionAuthorityUnresolvedCount}, vcr=${result.runtimeControl.verificationPipelineStatus}/${result.runtimeControl.verifiedCompletionRate}, clean=${result.runtimeControl.sessionCleanStateStatus}/${result.runtimeControl.sessionCleanStateStaleArtifactCount}, feedback=${result.runtimeControl.feedbackPromotionStatus}/${result.runtimeControl.feedbackPromotionCandidateCount}, diagnostic=${result.runtimeControl.diagnosticStatus}/${result.runtimeControl.diagnosticAttributionCount}, repair=${result.runtimeControl.repairGuidanceStatus}/${result.runtimeControl.repairActionCount}, audit=${result.runtimeControl.subsystemAuditStatus}/${result.runtimeControl.subsystemAuditPrimaryBottleneck}, ablation=${result.runtimeControl.ablationComparisonStatus}/${result.runtimeControl.ablationPrimaryMarginalSubsystem}, qualityDoc=${result.runtimeControl.qualityDocumentStatus}/${result.runtimeControl.qualityDocumentHealthyModuleCount}/${result.runtimeControl.qualityDocumentModuleCount}, quality=${result.runtimeControl.harnessQualityStatus}/${result.runtimeControl.harnessQualityScore}/${result.runtimeControl.harnessQualityGrade}, continuity=${result.runtimeControl.continuityStatus}/${result.runtimeControl.continuityDecisionCount}/${result.runtimeControl.continuityEstimatedRebuildMinutes}, course=${result.runtimeControl.courseAlignmentStatus}/${result.runtimeControl.courseAlignmentScore}/${result.runtimeControl.courseAlignmentPassingRequirementCount}, workers=${result.runtimeControl.workerFunctionCount}, replacements=${result.runtimeControl.replacementSlotCount}/${result.runtimeControl.replacementUnresolvedCount}, routes=${result.runtimeControl.providerRouteCount}, bus=${result.runtimeControl.runtimeBusStatus}/${result.runtimeControl.runtimeBusSubscriberCount}, invocations=${result.runtimeControl.completedInvocationCount}, missingInvocations=${result.runtimeControl.missingInvocationCount}, startup=${result.runtimeControl.startupReadinessStatus}, policy=${result.runtimeControl.policyStatus}, approval=${result.runtimeControl.approvalStatus}, budget=${result.runtimeControl.budgetStatus}, hooks=${result.runtimeControl.hookEmissionCount}, spans=${result.runtimeControl.traceSpanCount}\``);
    lines.push(`- validations: ${Object.entries(result.validationStatuses).map(([id, status]) => `\`${id}:${status}\``).join(", ") || "none"}`);
    lines.push(`- critic categories: ${result.criticCategories.map((category) => `\`${category}\``).join(", ") || "none"}`);
    if (result.firstFiveBlockers.length) {
      lines.push("- sample blockers:");
      for (const blocker of result.firstFiveBlockers) {
        lines.push(`  - [${blocker.category}] ${blocker.question}`);
      }
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, " ");
}
