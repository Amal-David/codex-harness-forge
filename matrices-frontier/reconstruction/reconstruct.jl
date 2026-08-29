using AmplNLReader
using NLPModels
using JSON3
using SHA

"""Build the challenge's canonical full-symmetric CSC KKT sparsity pattern."""
function kkt_pattern(path::String; fixed_threshold::Int = 50_000)
    nlp = AmplModel(path)
    try
        nvar = nlp.meta.nvar
        ncon = nlp.meta.ncon
        remove_fixed = nvar <= fixed_threshold

        keep = trues(nvar)
        if remove_fixed
            @inbounds for j in 1:nvar
                keep[j] = !(isfinite(nlp.meta.lvar[j]) && nlp.meta.lvar[j] == nlp.meta.uvar[j])
            end
        end
        vmap = zeros(Int, nvar)
        nv = 0
        @inbounds for j in 1:nvar
            if keep[j]
                nv += 1
                vmap[j] = nv
            end
        end

        eq = falses(ncon)
        @inbounds for i in 1:ncon
            eq[i] = isfinite(nlp.meta.lcon[i]) && isfinite(nlp.meta.ucon[i]) &&
                    nlp.meta.lcon[i] == nlp.meta.ucon[i]
        end
        eq_ids = findall(eq)
        ineq_ids = findall(.!eq)
        neq = length(eq_ids)
        nineq = length(ineq_ids)

        eq_rank = zeros(Int, ncon)
        ineq_rank = zeros(Int, ncon)
        for (k, i) in enumerate(eq_ids)
            eq_rank[i] = k
        end
        for (k, i) in enumerate(ineq_ids)
            ineq_rank[i] = k
        end

        # 1-based node layout: primals | inequality slacks | equality duals | inequality duals.
        slack_node(i) = nv + ineq_rank[i]
        eq_dual_node(i) = nv + nineq + eq_rank[i]
        ineq_dual_node(i) = nv + nineq + neq + ineq_rank[i]
        dual_node(i) = eq[i] ? eq_dual_node(i) : ineq_dual_node(i)
        n = nv + nineq + neq + nineq

        # Column adjacency sets. Add all diagonal entries up front.
        cols = [Set{Int}([j]) for j in 1:n]
        function add_edge!(a::Int, b::Int)
            push!(cols[a], b)
            push!(cols[b], a)
        end

        # Structural Lagrangian Hessian, lower triangle from AmplNLReader/NLPModels.
        hr = Vector{Int32}(undef, nlp.meta.nnzh)
        hc = Vector{Int32}(undef, nlp.meta.nnzh)
        NLPModels.hess_structure!(nlp, hr, hc)
        @inbounds for k in eachindex(hr)
            a0 = Int(hr[k]); b0 = Int(hc[k])
            if keep[a0] && keep[b0]
                add_edge!(vmap[a0], vmap[b0])
            end
        end

        # Jacobian bipartite block.
        jr = Vector{Int32}(undef, nlp.meta.nnzj)
        jc = Vector{Int32}(undef, nlp.meta.nnzj)
        NLPModels.jac_structure!(nlp, jr, jc)
        @inbounds for k in eachindex(jr)
            ci = Int(jr[k]); vj = Int(jc[k])
            if keep[vj]
                add_edge!(vmap[vj], dual_node(ci))
            end
        end

        # One slack-to-dual edge for every non-equality constraint.
        @inbounds for i in ineq_ids
            add_edge!(slack_node(i), ineq_dual_node(i))
        end

        indptr = Vector{Int}(undef, n + 1)
        indices = Int[]
        indptr[1] = 0
        for j in 1:n
            js = sort!(collect(cols[j]))
            append!(indices, (x - 1 for x in js))
            indptr[j + 1] = length(indices)
        end
        return (
            n = n,
            nnz = length(indices),
            indptr = indptr,
            indices = indices,
            nvar = nvar,
            kept_vars = nv,
            fixed_removed = nvar - nv,
            ncon = ncon,
            neq = neq,
            nineq = nineq,
            nnzj = nlp.meta.nnzj,
            nnzh = nlp.meta.nnzh,
        )
    finally
        amplmodel_finalize(nlp)
    end
end

function main()
    length(ARGS) >= 3 || error("usage: reconstruct.jl DEV_JSONL NL_DIR OUT_DIR")
    dev_path, nl_dir, out_dir = ARGS[1:3]
    mkpath(out_dir)

    dev = Dict{String, Any}()
    for line in eachline(dev_path)
        o = JSON3.read(line)
        dev[String(o.source)] = o
    end

    requested = if haskey(ENV, "CAL_NAMES")
        filter(!isempty, split(ENV["CAL_NAMES"], ','))
    else
        sort!(collect(keys(dev)))[1:min(40, length(dev))]
    end

    results = Any[]
    exact = 0
    for name in requested
        nl = joinpath(nl_dir, name * ".nl")
        if !isfile(nl)
            push!(results, (; name, status = "missing"))
            continue
        end
        try
            got = kkt_pattern(nl)
            want = dev[name]
            n_ok = got.n == Int(want.n)
            ptr_ok = got.indptr == Int.(want.indptr)
            idx_ok = got.indices == Int.(want.indices)
            ok = n_ok && ptr_ok && idx_ok
            exact += ok
            first_ptr = ptr_ok ? nothing : findfirst(!=, zip(got.indptr, Int.(want.indptr)))
            first_idx = idx_ok ? nothing : findfirst(!=, zip(got.indices, Int.(want.indices)))
            push!(results, (; name, status = ok ? "exact" : "mismatch",
                got_n = got.n, want_n = Int(want.n), got_nnz = got.nnz,
                want_nnz = Int(want.nnz), n_ok, ptr_ok, idx_ok,
                first_ptr, first_idx, got.nvar, got.kept_vars, got.fixed_removed,
                got.ncon, got.neq, got.nineq, got.nnzj, got.nnzh))
            println(name, '\t', ok ? "EXACT" : "MISMATCH", '\t', got.n, '\t', got.nnz,
                '\t', "fixed_removed=", got.fixed_removed, '\t', "neq=", got.neq,
                '\t', "nineq=", got.nineq)
        catch err
            bt = sprint(showerror, err, catch_backtrace())
            push!(results, (; name, status = "error", error = bt))
            println(name, '\t', "ERROR", '\t', replace(bt, '\n' => ' '))
        end
    end

    open(joinpath(out_dir, "calibration.json"), "w") do io
        JSON3.pretty(io, (; requested = length(requested), exact, results))
        write(io, '\n')
    end
    println("CALIBRATION requested=$(length(requested)) exact=$exact")
    exact == length(requested) || exit(2)
end

main()
