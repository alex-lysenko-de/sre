<script setup>

</script>

<template>
 <!-- TODO: Implement Child Detail View. Please use the same form as in GroupEditView - Kind add / edit-->
  <div class="container my-4">
    <div class="row justify-content-center">
      <div class="col-md-8 col-lg-6">
        <div class="card shadow-sm">
          <div class="card-body">
            <h3 class="card-title mb-4">Kind Detailansicht</h3>
            <!-- Form fields for child details go here -->
            <form>
              <div class="mb-3">
                <label for="childName" class="form-label fw-semibold">Name des Kindes</label>
                <input type="text" id="childName" class="form-control" placeholder="Name eingeben" />
              </div>
              <div class="mb-3">
                <label for="childAge" class="form-label fw-semibold">Alter</label>
                <input type="number" id="childAge" class="form-control" placeholder="Alter eingeben" />
              </div>
              <div class="mb-3">
                <label for="childGroup" class="form-label fw-semibold">Gruppe</label>
                <input type="text" id="childGroup" class="form-control" placeholder="Gruppe eingeben" />
              </div>
              <button type="submit" class="btn btn-primary w-100 fw-semibold">Speichern</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>

</template>